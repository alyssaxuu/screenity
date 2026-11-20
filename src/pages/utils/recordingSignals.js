// Per-take audio/capture signals, for telling "chose no mic" from "mic failed"
// and "the picker gave no audio" in a no-sound ticket. Booleans, counts, enums
// and error names only: never device labels, device ids or user text.
//
// Recorder side: every export is synchronous, never awaits and swallows its own
// errors, so it cannot throw into or delay a recorder. The SW does the storage
// and network work (Background/recording/recordingSignals.js).
import { consumeSystemAudioGuidanceOutcome } from "./systemAudioGuidance";

const PHASES = new Set(["mic-modal", "start", "stop"]);

const ENUMS = {
  // ContentState's mic-off modal. skipped-dont-ask: mic off and the user had
  // ticked "don't show again" earlier, so no modal.
  micModal: new Set(["confirm", "cancel", "dont-show-again", "skipped-dont-ask"]),
  micPermission: new Set(["granted", "denied", "prompt"]),
  displaySurface: new Set(["monitor", "window", "browser", "application"]),
  // systemAudioGuidance.js toast, per take. not-called: the host never calls
  // it (tab capture, or a recorder tab that shows its own warning).
  sysAudioGuidance: new Set([
    "shown",
    "already-shown",
    "suppressed",
    "not-applicable",
    "not-called",
    "pending",
  ]),
};

const BOOLS = [
  "micChosen",
  "micDevicePresent",
  "micAcquired",
  "micTrackMuted",
  "systemAudioRequested",
  "captureAudioDropped",
  "micEndedAtStop",
  "sysAudioEndedAtStop",
  "videoEndedAtStop",
];

const COUNTS = [
  "captureAudioTracks",
  "recordedAudioTracks",
  "micSampleRate",
  "videoWidth",
  "videoHeight",
  "videoFrameRate",
  "requestedFps",
  "requestedHeight",
  "deviceChangeCount",
  "silentStretchCount",
];

// DOMException names are short identifiers; anything else (a message, a label)
// collapses to "other" so free text never leaves the device.
export const errorName = (err) => {
  if (err == null || err === "") return null;
  const name = typeof err === "string" ? err : err?.name;
  return typeof name === "string" && /^[A-Za-z]{1,40}$/.test(name)
    ? name
    : "other";
};

export const pickRecordingSignals = (raw) => {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of BOOLS) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  for (const key of COUNTS) {
    const n = raw[key];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) {
      out[key] = Math.round(n * 100) / 100;
    }
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (allowed.has(raw[key])) out[key] = raw[key];
  }
  if (raw.micErrorName != null) {
    const name = errorName(raw.micErrorName);
    if (name) out.micErrorName = name;
  }
  return out;
};

let pending = {};
let takeOpen = false;
// Attempt id the open take's start report went to (null: the SW resolved it).
let startSentFor = null;
let deviceChanges = 0;
let listening = false;
const onDeviceChange = () => {
  deviceChanges += 1;
};

const firstTrack = (stream, kind) => {
  const list =
    kind === "audio"
      ? stream?.getAudioTracks?.()
      : stream?.getVideoTracks?.();
  return list?.[0] || null;
};

const value = (v) => (typeof v === "function" ? v() : v);

export const sendRecordingSignals = (phase, fields = {}, attemptId = null) => {
  try {
    if (!PHASES.has(phase)) return;
    const sent = chrome.runtime.sendMessage({
      type: "recording-signals",
      phase,
      attemptId: typeof attemptId === "string" ? attemptId : null,
      signals: pickRecordingSignals(fields),
    });
    sent?.catch?.(() => {});
  } catch {}
};

/** Clear the previous take's notes. Call where acquisition begins. */
export const resetRecordingSignals = () => {
  pending = {};
};

/** Merge fields into this take's next report. Unknown keys are dropped. */
export const noteRecordingSignals = (fields) => {
  try {
    Object.assign(pending, pickRecordingSignals(fields));
  } catch {}
};

export const bumpRecordingSignal = (key) => {
  try {
    if (!COUNTS.includes(key)) return;
    pending[key] = (pending[key] || 0) + 1;
  } catch {}
};

/** Mic facts once acquisition settles. The device id is reduced to a boolean. */
export const noteTakeMic = ({
  micChosen,
  micDeviceId,
  micPermission,
  micStream,
  micError,
} = {}) => {
  try {
    const track = firstTrack(micStream, "audio");
    const fields = {
      micChosen: Boolean(micChosen),
      micDevicePresent: Boolean(micDeviceId) && micDeviceId !== "none",
      micPermission,
      micAcquired: Boolean(track),
      micTrackMuted: track ? Boolean(track.muted) : undefined,
      micSampleRate: track?.getSettings?.()?.sampleRate,
    };
    if (micError != null) fields.micErrorName = micError;
    noteRecordingSignals(fields);
  } catch {}
};

/** Once per take, when its streams are wired. Sends the start report. */
export const reportTakeStart = ({
  attemptId = null,
  captureStream,
  systemAudio,
  recordedStream,
  recordedAudioTracks,
  requestedFps,
  requestedHeight,
  ...mic
} = {}) => {
  try {
    if (Object.keys(mic).length) noteTakeMic(mic);
    const video = firstTrack(captureStream, "video");
    const settings = video?.getSettings?.() || {};
    let recorded = value(recordedAudioTracks);
    if (recorded == null) recorded = recordedStream?.getAudioTracks?.()?.length;
    noteRecordingSignals({
      systemAudioRequested: Boolean(systemAudio),
      captureAudioTracks: captureStream?.getAudioTracks?.()?.length ?? 0,
      recordedAudioTracks: recorded,
      displaySurface: settings.displaySurface,
      videoWidth: settings.width,
      videoHeight: settings.height,
      videoFrameRate: settings.frameRate,
      requestedFps,
      requestedHeight,
      sysAudioGuidance: consumeSystemAudioGuidanceOutcome(),
    });
    sendRecordingSignals("start", pending, attemptId);
    startSentFor = attemptId;
    deviceChanges = 0;
    if (!takeOpen) {
      takeOpen = true;
      const devices =
        typeof navigator !== "undefined" ? navigator.mediaDevices : null;
      if (!listening && devices?.addEventListener) {
        devices.addEventListener("devicechange", onDeviceChange);
        listening = true;
      }
    }
  } catch {}
};

/**
 * The take's attempt id once the recorder learns it (start-recording-tab). A
 * restart reuses the streams under a new id, so the start report is sent
 * again for that id.
 */
export const noteTakeAttempt = (attemptId) => {
  try {
    if (typeof attemptId !== "string" || !attemptId) return;
    if (takeOpen && startSentFor && startSentFor !== attemptId) {
      deviceChanges = 0;
      pending.sysAudioGuidance = consumeSystemAudioGuidanceOutcome();
      sendRecordingSignals("start", pending, attemptId);
    }
    startSentFor = attemptId;
  } catch {}
};

/** At stop, before tracks are torn down. Only the first call per take sends. */
export const reportTakeStop = ({
  attemptId = null,
  micStream,
  captureStream,
} = {}) => {
  try {
    if (!takeOpen) return;
    takeOpen = false;
    if (listening) {
      listening = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
    }
    const ended = (t) => (t ? t.readyState === "ended" : undefined);
    const sysTrack = pending.systemAudioRequested
      ? firstTrack(captureStream, "audio")
      : null;
    sendRecordingSignals(
      "stop",
      {
        micEndedAtStop: ended(firstTrack(micStream, "audio")),
        sysAudioEndedAtStop: ended(sysTrack),
        videoEndedAtStop: ended(firstTrack(captureStream, "video")),
        deviceChangeCount: deviceChanges,
        // Absent unless a silence watchdog ran (it notes 0 when armed).
        silentStretchCount: pending.silentStretchCount,
      },
      attemptId || startSentFor,
    );
  } catch {}
};

// SW side: which take a report belongs to, and the merged record kept for the
// support zip and form. A stop report goes to the take its start went to (the
// stored attempt id may be cleared by then). A mic-modal report for a new click
// must not replace a started take's record, or a cancelled click wipes the
// facts of the take the user is writing in about.
const ATTEMPT_ID = /^ra-[a-z0-9-]+$/;

export const resolveRecordingSignals = (message, store = {}) => {
  const phase = message?.phase;
  if (!PHASES.has(phase)) return null;
  const signals = pickRecordingSignals(message?.signals);
  const prev = store.lastRecordingSignals || null;
  const valid = (id) => (typeof id === "string" && ATTEMPT_ID.test(id) ? id : null);
  const attemptId =
    phase === "mic-modal"
      ? valid(message?.attemptId)
      : valid(message?.attemptId) ||
        (phase === "stop" ? valid(prev?.attemptId) : null) ||
        valid(store.recordingAttemptId);
  if (!attemptId) return null;
  const started = prev?.phases?.includes("start");
  if (phase === "mic-modal" && started && prev.attemptId !== attemptId) {
    return {
      attemptId,
      phase,
      signals,
      record: { ...prev, nextModal: { attemptId, micModal: signals.micModal } },
    };
  }
  const { nextModal, ...prevRecord } = prev || {};
  let base = { attemptId };
  if (prev?.attemptId === attemptId) base = prevRecord;
  else if (nextModal?.attemptId === attemptId) {
    base = { attemptId, micModal: nextModal.micModal, phases: ["mic-modal"] };
  }
  return {
    attemptId,
    phase,
    signals,
    record: {
      ...base,
      ...signals,
      attemptId,
      phases: [...new Set([...(base.phases || []), phase])],
      at: Date.now(),
    },
  };
};

// One line for the support form and debug block, e.g.
// "mic:on,acq:0,err:NotReadableError,perm:granted,cap:0,rec:0,modal:confirm".
// acq:1 with an err means the chosen device failed and the default one was
// used instead.
export const formatRecordingSignals = (s) => {
  if (!s || typeof s !== "object") return null;
  const b = (v) => (v == null ? "?" : v ? "1" : "0");
  const bits = [
    `mic:${s.micChosen == null ? "?" : s.micChosen ? "on" : "off"}`,
    `dev:${b(s.micDevicePresent)}`,
    `acq:${b(s.micAcquired)}`,
  ];
  if (s.micErrorName) bits.push(`err:${s.micErrorName}`);
  if (s.micPermission) bits.push(`perm:${s.micPermission}`);
  if (s.micTrackMuted) bits.push("micMuted");
  bits.push(`sys:${b(s.systemAudioRequested)}`);
  if (s.captureAudioTracks != null) bits.push(`cap:${s.captureAudioTracks}`);
  if (s.captureAudioDropped) bits.push("capDropped");
  if (s.recordedAudioTracks != null) bits.push(`rec:${s.recordedAudioTracks}`);
  if (s.displaySurface) bits.push(`surf:${s.displaySurface}`);
  if (s.micModal) bits.push(`modal:${s.micModal}`);
  if (s.sysAudioGuidance) bits.push(`guide:${s.sysAudioGuidance}`);
  if (s.micEndedAtStop) bits.push("micEnded");
  if (s.sysAudioEndedAtStop) bits.push("sysEnded");
  if (s.videoEndedAtStop) bits.push("videoEnded");
  return bits.join(",").slice(0, 200);
};
