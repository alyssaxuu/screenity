// A take whose browser, tab or recorder died with nobody to clear its flags is
// only found by the stale sweep on the next service worker start. This reports
// what the flags still hold, so a crash mid-countdown or mid-recording leaves
// an event.
import { emitRecordingTelemetry } from "./emitRecordingTelemetry";
import { healthText } from "../offscreen/hostWatch";

const SESSION_MARK = "swBrowserSessionMark";
const VERSION_KEY = "lastSwExtVersion";

const SNAP_KEYS = [
  "recording",
  "pendingRecording",
  "restarting",
  "recordingTab",
  "offscreen",
  "customRegion",
  "firstChunkAt",
  "lastChunkAt",
  "recordingAttemptId",
  "startFlowTrace",
  "recorderHostHealth",
];

const ageS = (t, now) => (Number.isFinite(t) && t > 0 ? Math.round((now - t) / 1000) : "na");

// storage.session empties on browser restart and extension reload, so a missing
// mark means first worker of a new session. Call once per worker start.
export const noteSwStart = async () => {
  const out = { brw: "na", upd: "na" };
  try {
    const s = await chrome.storage.session.get(SESSION_MARK);
    const seen = Boolean(s?.[SESSION_MARK]);
    out.brw = seen ? "same" : "new";
    if (!seen) await chrome.storage.session.set({ [SESSION_MARK]: Date.now() });
  } catch {}
  try {
    const ver = chrome.runtime?.getManifest?.()?.version || null;
    const prev = (await chrome.storage.local.get(VERSION_KEY))?.[VERSION_KEY] || null;
    if (prev && ver) out.upd = prev === ver ? 0 : 1;
    if (ver && prev !== ver) await chrome.storage.local.set({ [VERSION_KEY]: ver });
  } catch {}
  return out;
};

// Latest start-flow checkpoint, from this attempt's trace only.
const lastStep = (trace, attemptId) => {
  if (!trace || typeof trace !== "object") return null;
  if (attemptId && trace.attemptId && trace.attemptId !== attemptId) return null;
  let name = null;
  let at = 0;
  for (const [k, v] of Object.entries(trace.t || {})) {
    if (Number.isFinite(v) && v >= at) {
      name = k;
      at = v;
    }
  }
  return name ? { name, at, outcome: trace.outcome || "na" } : null;
};

export const describeStaleTake = (s, sw, now = Date.now()) => {
  const step = lastStep(s.startFlowTrace, s.recordingAttemptId);
  const host = s.offscreen ? "off" : s.recordingTab != null ? "tab" : "none";
  return (
    `rec=${s.recording ? 1 : 0} pend=${s.pendingRecording ? 1 : 0} rst=${s.restarting ? 1 : 0}` +
    ` host=${host} rgn=${s.customRegion ? 1 : 0} brw=${sw?.brw ?? "na"} upd=${sw?.upd ?? "na"}` +
    ` stage=${step ? `${step.name}/${ageS(step.at, now)}s out=${step.outcome}` : "na"}` +
    ` first=${ageS(s.firstChunkAt, now)}s last=${ageS(s.lastChunkAt, now)}s` +
    healthText(s.recorderHostHealth)
  );
};

// Call in the sweep's clear branch before it writes: the read is issued now so
// it sees the flags about to be cleared. Keyed on the attempt id so the event
// lands beside that attempt's initiated beacon.
export const reportStaleTake = (swStartPromise) => {
  const snapPromise = chrome.storage.local.get(SNAP_KEYS);
  return (async () => {
    try {
      const [s, sw] = await Promise.all([snapPromise, swStartPromise]);
      void emitRecordingTelemetry("recording_forensic_event", {
        name: "stale-take-cleared",
        reason: "sw-start",
        ...(s.recordingAttemptId ? { recordingSessionId: s.recordingAttemptId } : {}),
        errMsg: describeStaleTake(s, sw),
      });
    } catch {}
  })();
};
