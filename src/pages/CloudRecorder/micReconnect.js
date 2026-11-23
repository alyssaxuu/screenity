import {
  reacquireMicWindow,
  MIC_REACQUIRE_MAX_PER_WINDOW,
  MIC_REACQUIRE_RATE_WINDOW_MS,
} from "../utils/micReacquire.js";
import {
  buildMicDropInWindowEvent,
  buildMicDropRecoveredEvent,
} from "../utils/micDropElapsed.js";
import { MIC_DROP_STOP_REASON } from "../utils/micDropHandoff.js";

// Only a mic still listed and allowed is retried at once. An unplugged one
// waits for devicechange inside the same window; a revoked one cannot return.
export const classifyMicEnd = ({ deviceListed, permissionState }) => {
  if (permissionState === "denied") return "revoked";
  if (deviceListed === false) return "unplugged";
  return "transient";
};

// A returning mic needs a bus in the screen file: always there in a mixed take,
// in a separated take only when system audio put an audio track in it. The
// separated mic file holds the dead track and cannot swap it.
export const canReconnectMic = ({ separated, systemOnBus }) =>
  !separated || Boolean(systemOnBus);

export const MIC_DROP_NONE = { count: 0, firstLostAtMs: null, firstBackAtMs: null };

// A drop opens when the track ends, before the outcome is known.
export const dropStarted = (prev, lostAtMs) => {
  const base = prev || MIC_DROP_NONE;
  return {
    ...base,
    count: base.count + 1,
    firstLostAtMs: base.count === 0 ? lostAtMs : base.firstLostAtMs,
  };
};

// Only the first drop is timed in the note.
export const dropRecovered = (prev, backAtMs) =>
  prev && prev.count === 1 && prev.firstBackAtMs == null
    ? { ...prev, firstBackAtMs: backAtMs }
    : prev;

// Open drop (or one that ended the take): the note says audio after that point
// is missing. Recovered: it says when the mic left and came back.
export const handoffFor = (history, openLostAtMs) => {
  if (!history || history.count === 0) return null;
  if (openLostAtMs != null) {
    return {
      elapsedMs: openLostAtMs,
      reason: MIC_DROP_STOP_REASON,
      micDropCount: history.count,
    };
  }
  if (history.firstBackAtMs != null) {
    return {
      elapsedMs: history.firstLostAtMs,
      micBackAtMs: history.firstBackAtMs,
      micDropCount: history.count,
    };
  }
  return null;
};

const permissionOf = async (query) => {
  try {
    return (await query())?.state ?? null;
  } catch {
    return null;
  }
};

const listedOf = async (enumerate, deviceId) => {
  try {
    const list = await enumerate();
    if (!Array.isArray(list)) return null;
    return list.some(
      (d) => d.kind === "audioinput" && (!deviceId || d.deviceId === deviceId),
    );
  } catch {
    return null;
  }
};

// Same device only, never a substitute. A revoked mic, or a take with nowhere
// to put the voice, returns ok:false at once so the caller keeps its stop rule.
export async function reconnectCloudMic({
  deviceId,
  previousLabel,
  sameDevice,
  separated,
  systemOnBus,
  startedAt = Date.now(),
  enumerate,
  queryPermission,
  isStale,
  acquireExact,
  wire,
  reacquire = reacquireMicWindow,
  now = () => Date.now(),
}) {
  const [deviceListed, permissionState] = await Promise.all([
    listedOf(enumerate, deviceId),
    permissionOf(queryPermission),
  ]);
  const klass = classifyMicEnd({ deviceListed, permissionState });
  if (klass === "revoked") {
    return { ok: false, klass, reason: "revoked", attempts: 0, gapMs: now() - startedAt };
  }
  if (!canReconnectMic({ separated, systemOnBus })) {
    return { ok: false, klass, reason: "no-target", attempts: 0, gapMs: now() - startedAt };
  }
  const out = await reacquire({
    startedAt,
    deviceId,
    previousLabel,
    sameDevice,
    isStale,
    // Exact device only: the app's own acquire falls back to another mic and
    // can post a toast, which tab capture would record.
    acquire: acquireExact,
    acquireExact,
    wire,
    enumerate,
  });
  return { ...out, klass };
}

// Mic-ended flow with side effects injected so it runs against fakes.
// CloudRecorder.jsx supplies the real refs and audio graph.
export const createMicEndHandler = (d) => async (rawTrack) => {
  if (d.isFinishing() || d.isSent()) return;
  const live = d.getLiveTrack();
  if (live && live !== rawTrack) return;
  const generation = d.getGeneration();
  const endedAt = d.now();
  d.freezeAudioClock(endedAt);
  d.stopMicRecorder();
  const { fullLabel, ...info } = d.describeTrack(rawTrack, endedAt);
  d.diag("cloudrecorder-mic-track-ended", info);
  const elapsedMs = await d.elapsedAt(endedAt);

  // Recorded before the outcome so a Stop during the window still hands the
  // editor the drop time.
  let history = dropStarted(d.getHistory(), elapsedMs);
  d.setHistory(history);
  d.setHandoff(handoffFor(history, elapsedMs));
  d.setFlagSet(true);
  await d
    .storageSet({
      micReconnecting: true,
      lastTrackEndEvent: buildMicDropInWindowEvent({
        info: { ...info, ts: endedAt },
        elapsedMs,
      }),
    })
    .catch(() => {});

  const budget = d.budget;
  budget.recent = budget.recent.filter(
    (t) => endedAt - t < MIC_REACQUIRE_RATE_WINDOW_MS,
  );
  budget.recent.push(endedAt);
  let outcome;
  if (budget.recent.length > MIC_REACQUIRE_MAX_PER_WINDOW) {
    outcome = { ok: false, klass: null, reason: "rate-cap", attempts: 0 };
  } else {
    try {
      outcome = await d.reconnect({
        startedAt: endedAt,
        previousLabel: fullLabel || info.trackLabel,
        isStale: () =>
          d.isFinishing() || d.isSent() || d.getGeneration() !== generation,
      });
    } catch {
      outcome = { ok: false, klass: null, reason: "error", attempts: 0 };
    }
  }
  const clearFlag = () =>
    d.getFlagSet()
      ? (d.setFlagSet(false), d.storageSet({ micReconnecting: false }).catch(() => {}))
      : Promise.resolve();
  // A newer take owns the flag and the handoff now.
  if (d.getGeneration() !== generation) return;
  const backAt = d.now();
  d.diag("cloudrecorder-mic-reacquire", {
    ok: outcome.ok,
    klass: outcome.klass,
    reason: outcome.reason || null,
    attempts: outcome.attempts,
    gapMs: backAt - endedAt,
  });
  if (d.isSent() || d.isFinishing()) {
    await clearFlag();
    return;
  }
  if (outcome.ok) {
    const backMs = await d.elapsedAt(backAt);
    history = dropRecovered(d.getHistory(), backMs);
    d.setHistory(history);
    d.setHandoff(handoffFor(history, null));
    await d.afterReturn();
    d.setFlagSet(false);
    await d
      .storageSet({
        micReconnecting: false,
        lastTrackEndEvent: buildMicDropRecoveredEvent({ info }),
      })
      .catch(() => {});
    return;
  }
  d.setFlagSet(false);
  await d
    .storageSet({
      micReconnecting: false,
      lastTrackEndEvent: {
        reason: "audio-track-ended",
        source: "mic",
        ts: endedAt,
        elapsedMs,
        trackLabel: info.trackLabel,
        recordingDuration: info.recordingDuration,
      },
    })
    .catch(() => {});
  d.stop("audio-track-ended");
};

export const stopReconnectedMic = (stream) => {
  try {
    stream?.getTracks?.().forEach((t) => t.stop());
  } catch {}
};

// The bus gain carries the sound; the track flag keeps the device itself muted.
export const applyBusMicMute = ({ gain, stream, active }) => {
  if (gain?.gain) gain.gain.value = active ? 1 : 0;
  stream?.getAudioTracks?.().forEach((t) => {
    t.enabled = Boolean(active);
  });
};

// Rebuilds a mic whose track ended: Restart keeps the capture streams, and a
// mic can end between the stream and Start. One path for stream, bus node,
// gain, rawMicStream, micActive and the ended watcher.
export const REBUILD_ACQUIRE_LIMIT_MS = 4000;

export async function ensureLiveMic(d) {
  const track = d.getRawTrack();
  if (!track || track.readyState !== "ended") return { action: "none" };
  d.teardown();
  const separated = d.isSeparated();
  let stream = null;
  // Bounded so a slow Bluetooth acquire cannot outlast the background's
  // restart ack; a stream arriving after the limit is released.
  const limitMs = d.timeoutMs ?? REBUILD_ACQUIRE_LIMIT_MS;
  let timer;
  let timedOut = false;
  const pending = Promise.resolve()
    .then(() => d.acquire(separated))
    .then((s) => {
      if (timedOut) s?.getTracks?.().forEach((t) => t.stop());
      return s;
    });
  try {
    stream = await Promise.race([
      pending,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve(null);
        }, limitMs);
      }),
    ]);
  } catch {
    stream = null;
  } finally {
    clearTimeout(timer);
  }
  pending.catch(() => {});
  const fresh = stream?.getAudioTracks?.()[0];
  const lost = () => {
    stream?.getTracks?.().forEach((t) => t.stop());
    d.setRaw(null);
    d.onLost();
    // At Start the take ends anyway; the saved mic setting must stay as it was.
    if (!d.atStart) d.persistOff();
    return { action: "lost" };
  };
  if (!fresh) return lost();
  d.setRaw(stream);
  if (!separated && !d.useOnBus(stream, fresh)) return lost();
  if (separated) await d.muteIfOff(stream);
  d.watch(fresh);
  return { action: "reacquired" };
}

export function clearReconnectFlag(d) {
  if (!d.getFlagSet()) return false;
  d.setFlagSet(false);
  Promise.resolve(d.storageSet({ micReconnecting: false })).catch(() => {});
  return true;
}
