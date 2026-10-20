// Passive breadcrumbs for a recorder document that vanishes mid-recording:
// stamps why we closed the offscreen doc, reports disconnects we didn't cause.
import { emitRecordingTelemetry } from "../recording/emitRecordingTelemetry";

const PORT_NAME = "recorder-host";
const INTENT_WINDOW_MS = 15000;
// Literal copy of RESUME_RETRY_ALARM (resumePendingUploads.js) to keep this module
// dependency-light for its tests. Fires past DEAD_HOST_QUIET_MS.
const RESUME_RETRY_ALARM = "resume-pending-uploads-retry";
const RESUME_AFTER_LOST_MIN = 5.5;
const STATE_KEYS = [
  "recording",
  "pendingRecording",
  "firstChunkAt",
  "lastChunkAt",
];

let lastIntent = null;

const ageS = (t) => (t ? Math.round((Date.now() - t) / 1000) : "na");

const docKind = (url) => {
  if (!url) return "none";
  if (url.includes("resume=1")) return "resume";
  return url.includes("cloud=1") ? "cloud" : "plain";
};

// Only during a live recording: emitRecordingTelemetry falls back to the last
// stored session, which would tag an unrelated one once recording is over.
const emit = async (name, reason, statePromise, contextsPromise) => {
  try {
    const s = await (statePromise || chrome.storage.local.get(STATE_KEYS));
    if (!(s.recording || s.pendingRecording)) return;
    let kind = "na";
    if (contextsPromise) {
      const ctx = await contextsPromise.catch(() => null);
      kind = docKind(ctx?.[0]?.documentUrl);
    }
    void emitRecordingTelemetry("recording_forensic_event", {
      name,
      reason,
      errMsg: `rec=${s.recording ? 1 : 0} pend=${s.pendingRecording ? 1 : 0} first=${ageS(
        s.firstChunkAt,
      )}s last=${ageS(s.lastChunkAt)}s doc=${kind}`,
    });
  } catch {}
};

// Call right before closeDocument(). Reads are issued now and awaited later so
// the close isn't delayed.
export const noteOffscreenClose = (caller) => {
  try {
    lastIntent = { caller, at: Date.now() };
    const statePromise = chrome.storage.local.get(STATE_KEYS);
    const contextsPromise = chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    void emit("offscreen-close", caller, statePromise, contextsPromise);
  } catch {}
};

export const noteOffscreenCloseSkipped = (caller) => {
  try {
    void emit(
      "offscreen-close-skipped",
      caller,
      chrome.storage.local.get(STATE_KEYS),
      chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] }),
    );
  } catch {}
};

export const initRecorderHostWatch = () => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAME) return;
    if (docKind(port.sender?.url) === "resume") return;
    port.onDisconnect.addListener(() => {
      if (lastIntent && Date.now() - lastIntent.at < INTENT_WINDOW_MS) return;
      void emit("recorder-host-lost", "port-disconnect");
      try {
        chrome.alarms?.create?.(RESUME_RETRY_ALARM, {
          delayInMinutes: RESUME_AFTER_LOST_MIN,
        });
      } catch {}
    });
  });
};
