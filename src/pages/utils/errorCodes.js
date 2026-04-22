/**
 * Error codes for recording flows.
 *
 * Codes are stored in `lastRecordingError.code` and flow through diagnostics
 * and support context. They never contain URLs, page content, or user data.
 */

// -- Recording Start --
export const REC_START_PERM = "REC_START_PERM"; // permission denied
export const REC_START_STREAM = "REC_START_STREAM"; // getUserMedia / getDisplayMedia failed
export const REC_START_CODEC = "REC_START_CODEC"; // MediaRecorder or WebCodecs init failed
export const REC_START_REGION = "REC_START_REGION"; // region/crop target setup failed
export const REC_START_TAB = "REC_START_TAB"; // tab capture or message routing failed
export const REC_START_TIMEOUT = "REC_START_TIMEOUT"; // start flow timed out
export const REC_START_CANCEL = "REC_START_CANCEL"; // user cancelled the capture picker
export const REC_START_NOT_READY = "REC_START_NOT_READY"; // recorder tab not ready (likely discarded)
export const REC_START_NO_STREAM_MSG = "REC_START_NO_STREAM_MSG"; // start requested but streaming-data message never arrived from SW

// -- Recording Runtime --
export const REC_RUN_STREAM_END = "REC_RUN_STREAM_END"; // stream ended unexpectedly
export const REC_RUN_MEMORY = "REC_RUN_MEMORY"; // memory/quota pressure

// -- Recording Stop --
export const REC_STOP_CHUNKS = "REC_STOP_CHUNKS"; // chunk delivery failed
export const REC_STOP_EDITOR = "REC_STOP_EDITOR"; // editor tab open failed

// -- Drive --
export const DRV_AUTH = "DRV_AUTH"; // auth failed
export const DRV_FOLDER = "DRV_FOLDER"; // folder operation failed
export const DRV_UPLOAD = "DRV_UPLOAD"; // file upload failed

// -- Fallback --
export const UNKNOWN = "UNKNOWN";

// -- Classifier --

// Patterns that strongly indicate the user explicitly cancelled the picker.
// Note: "aborterror" is intentionally NOT here — Chrome throws AbortError for
// picker dismissal but also for unrelated abort scenarios.  We only classify
// AbortError as cancel when the caller passes the "cancel-modal" hint.
const CANCEL_PATTERNS = [
  "cancelled",
  "canceled",
  "cancel-modal",
  "user cancelled",
  "user canceled",
];

const PERM_PATTERNS = [
  "permission",
  "not allowed",
  "denied",
  "notallowederror",
  "dismissedbyuser",
  "permission is blocked",
];

const STREAM_PATTERNS = [
  "no video track",
  "no audio",
  "getusermedia",
  "getdisplaymedia",
  "stream unavailable",
  "camera stream",
  "display stream missing",
  "failed to get user media",
  "failed to start streaming",
  "failed to start stream",
  "failed to setup streaming",
  "failed to get stream",
  "failed to access screen stream",
  "failed to access region stream",
  "no streams to record",
  "no screen video track",
  "no camera video track",
  "notreadableerror",
  "notfounderror",
  "overconstrainederror",
];

const CODEC_PATTERNS = [
  "mediarecorder",
  "webcodecs",
  "failed to start recording",
  "codec",
  "mimeType",
  "mime type",
  "recording error:",
];

const TAB_PATTERNS = [
  "no recording tab",
  "tab stream",
  "unable to resolve tab",
  "tab capture",
  "message routing",
];

const TIMEOUT_PATTERNS = [
  "taking too long",
  "timed out",
  "timeout",
];

const REGION_PATTERNS = [
  "crop target",
  "crop region",
  "failed to crop",
  "region capture",
  "no crop target",
];

/**
 * Classify an error string into an error code.
 *
 * @param {string} errorStr  — raw error message
 * @param {string} [errorType] — optional hint ("stream-error", "cancel-modal", etc.)
 * @returns {string} one of the exported error code constants
 */
export const classifyError = (errorStr = "", errorType = "") => {
  const lower = String(errorStr).toLowerCase();
  const typeLower = String(errorType).toLowerCase();

  // Explicit cancel — either the caller flagged it or the message clearly says so.
  // AbortError only counts as cancel when the caller confirms via "cancel-modal",
  // since Chrome reuses AbortError for non-cancel scenarios too.
  if (typeLower === "cancel-modal") {
    return REC_START_CANCEL;
  }
  if (CANCEL_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_CANCEL;
  }

  // Permission denied
  if (PERM_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_PERM;
  }

  if (lower.includes("streaming-data never arrived")) {
    return REC_START_NO_STREAM_MSG;
  }

  // Recorder not ready (stream ref missing, likely tab discarded during countdown)
  if (lower.includes("recording not ready") || lower.includes("screen stream is missing")) {
    return REC_START_NOT_READY;
  }

  // Stream acquisition
  if (STREAM_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_STREAM;
  }

  // Codec / recorder init
  if (CODEC_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_CODEC;
  }

  // Timeout
  if (TIMEOUT_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_TIMEOUT;
  }

  // Region / crop
  if (REGION_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_REGION;
  }

  // Stream ended (runtime, not start)
  if (typeLower === "stream-ended" || lower.includes("stream ended")) {
    return REC_RUN_STREAM_END;
  }

  // Tab routing
  if (TAB_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_TAB;
  }

  // Memory / storage
  if (
    lower.includes("memory") ||
    lower.includes("quota") ||
    lower.includes("indexeddb") ||
    lower.includes("local storage is blocked") ||
    lower.includes("local buffer")
  ) {
    return REC_RUN_MEMORY;
  }

  // Bare AbortError without a cancel-modal hint — this is ambiguous, so treat
  // it as a stream-level failure rather than assuming user intent.
  if (lower.includes("aborterror")) {
    return REC_START_STREAM;
  }

  return UNKNOWN;
};

// -- Helpers --

/** Short ID for a recording attempt (no crypto dependency). */
export const makeRecordingAttemptId = () => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ra-${ts}-${rand}`;
};

/** Derive a short support code from an attempt ID. */
export const makeSupportCode = (attemptId) => {
  if (!attemptId) return "SCR-0000";
  const hash = attemptId.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SCR-${hash}-${date}`;
};
