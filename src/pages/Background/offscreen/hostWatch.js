// Passive breadcrumbs for a recorder document that vanishes mid-recording:
// stamps why we closed the offscreen doc, reports disconnects we didn't cause.
import { emitRecordingTelemetry } from "../recording/emitRecordingTelemetry";
import { noteTakeEvent } from "../recording/adaptiveHistory";

const PORT_NAME = "recorder-host";
const INTENT_WINDOW_MS = 15000;
// Literal copy of RESUME_RETRY_ALARM (resumePendingUploads.js) to keep this module
// dependency-light for its tests. Fires past DEAD_HOST_QUIET_MS.
const RESUME_RETRY_ALARM = "resume-pending-uploads-retry";
const RESUME_AFTER_LOST_MIN = 5.5;
// A take parked for the next recording resumes once that recording stops. Nothing runs
// the resume chain after a keyboard-shortcut start, so the close that parked it arms the first retry.
const RESUME_AFTER_PARK_MIN = 2;
const HEALTH_KEY = "recorderHostHealth";
const STATE_KEYS = [
  "recording",
  "pendingRecording",
  "firstChunkAt",
  "lastChunkAt",
  HEALTH_KEY,
];

let lastIntent = null;

const ageS = (t) => (t ? Math.round((Date.now() - t) / 1000) : "na");

const docKind = (url) => {
  if (!url) return "none";
  if (url.includes("resume=1")) return "resume";
  return url.includes("cloud=1") ? "cloud" : "plain";
};

// The recorder document stamps its heap and device memory while it lives, so a
// death during start still says how loaded it was. Absent on older documents.
export const healthText = (h) => {
  if (!h || typeof h !== "object") return "";
  const n = (v) => (Number.isFinite(v) ? v : "na");
  return ` heap=${n(h.jsHeapUsedMb)}/${n(h.jsHeapLimitMb)}MB mem=${n(h.deviceMemoryGb)}GB cpu=${n(
    h.hardwareConcurrency,
  )} health=${ageS(h.at)}s lag=${n(h.lagP90Ms)}/${n(h.lagMaxMs)}ms press=${h.cpuPressure || "na"}/${
    h.cpuPressureWorst || "na"
  }/${h.cpuPressureStatus || "na"}`;
};

// Only during a live recording: emitRecordingTelemetry falls back to the last
// stored session, which would tag an unrelated one once recording is over.
const emit = async (name, reason, statePromise, contextsPromise) => {
  try {
    const s = await (statePromise || chrome.storage.local.get(STATE_KEYS));
    if (!(s.recording || s.pendingRecording)) return;
    if (name === "recorder-host-lost") void noteTakeEvent({ hostLost: true });
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
      )}s last=${ageS(s.lastChunkAt)}s doc=${kind}${healthText(s[HEALTH_KEY])}`,
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

export const armResumeAfterPark = async () => {
  try {
    const s = await chrome.storage.local.get(STATE_KEYS);
    if (!(s.recording || s.pendingRecording)) return;
    chrome.alarms?.create?.(RESUME_RETRY_ALARM, {
      delayInMinutes: RESUME_AFTER_PARK_MIN,
    });
  } catch {}
};

export const initRecorderHostWatch = () => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAME) return;
    if (docKind(port.sender?.url) === "resume") return;
    port.onDisconnect.addListener(() => {
      if (lastIntent && Date.now() - lastIntent.at < INTENT_WINDOW_MS) {
        if (lastIntent.caller === "close-with-flush") void armResumeAfterPark();
        return;
      }
      void emit("recorder-host-lost", "port-disconnect");
      try {
        chrome.alarms?.create?.(RESUME_RETRY_ALARM, {
          delayInMinutes: RESUME_AFTER_LOST_MIN,
        });
      } catch {}
    });
  });
};
