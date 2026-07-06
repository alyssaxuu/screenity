// recording-flow error codes. land in lastRecordingError.code and the
// diagnostic / support payloads. never carry URLs or user data.

export const REC_START_PERM = "REC_START_PERM";
export const REC_START_STREAM = "REC_START_STREAM";
export const REC_START_CODEC = "REC_START_CODEC";
export const REC_START_REGION = "REC_START_REGION";
export const REC_START_TAB = "REC_START_TAB";
export const REC_START_TIMEOUT = "REC_START_TIMEOUT";
export const REC_START_CANCEL = "REC_START_CANCEL";
export const REC_START_NOT_READY = "REC_START_NOT_READY";
export const REC_START_NO_STREAM_MSG = "REC_START_NO_STREAM_MSG";

export const REC_RUN_STREAM_END = "REC_RUN_STREAM_END";
export const REC_RUN_MEMORY = "REC_RUN_MEMORY";

export const REC_STOP_CHUNKS = "REC_STOP_CHUNKS";
export const REC_STOP_EDITOR = "REC_STOP_EDITOR";

export const DRV_AUTH = "DRV_AUTH";
export const DRV_FOLDER = "DRV_FOLDER";
export const DRV_UPLOAD = "DRV_UPLOAD";

export const UNKNOWN = "UNKNOWN";

// "aborterror" is intentionally NOT here: Chrome throws AbortError for
// picker dismissal AND unrelated abort scenarios. AbortError is only a
// cancel when the caller passes the "cancel-modal" hint.
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
  "the screen stream",
  "failed to access region stream",
  "no streams to record",
  "no screen video track",
  "no camera video track",
  "no video data",
  "notreadableerror",
  "notfounderror",
  "overconstrainederror",
];

const MEMORY_PATTERNS = [
  "memory",
  "quota",
  "indexeddb",
  "local storage is blocked",
  "local buffer",
  "browser storage",
  "out of storage",
  "free up disk",
];

const CODEC_PATTERNS = [
  "mediarecorder",
  "webcodecs",
  "failed to start recording",
  "codec",
  "mimeType",
  "mime type",
  "recording error:",
  "video encoder",
  "audio encoder",
];

const TAB_PATTERNS = [
  "no recording tab",
  "tab stream",
  "unable to resolve tab",
  "tab capture",
  "message routing",
  "this tab's video",
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
 * @param {string} errorStr , raw error message
 * @param {string} [errorType], optional hint ("stream-error", "cancel-modal", etc.)
 * @returns {string} one of the exported error code constants
 */
export const classifyError = (errorStr = "", errorType = "") => {
  const lower = String(errorStr).toLowerCase();
  const typeLower = String(errorType).toLowerCase();

  // AbortError only counts as cancel via the "cancel-modal" hint; Chrome
  // reuses AbortError for non-cancel scenarios.
  if (typeLower === "cancel-modal") {
    return REC_START_CANCEL;
  }
  if (CANCEL_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_CANCEL;
  }

  if (PERM_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_PERM;
  }

  if (
    lower.includes("streaming-data never arrived") ||
    lower.includes("didn't start in time") ||
    lower.includes("didnt start in time")
  ) {
    return REC_START_NO_STREAM_MSG;
  }

  // Recorder tab discarded during countdown.
  if (lower.includes("recording not ready") || lower.includes("screen stream is missing")) {
    return REC_START_NOT_READY;
  }

  // Tab/region capture failures (often wrapped in a getUserMedia error). Match
  // before STREAM so the user gets the actionable tab message, not a generic one.
  if (lower.includes("tab capture") || lower.includes("this tab's video")) {
    return REC_START_TAB;
  }

  if (STREAM_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_STREAM;
  }

  if (CODEC_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_CODEC;
  }

  if (TIMEOUT_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_TIMEOUT;
  }

  if (REGION_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_REGION;
  }

  if (typeLower === "stream-ended" || lower.includes("stream ended")) {
    return REC_RUN_STREAM_END;
  }

  if (TAB_PATTERNS.some((p) => lower.includes(p))) {
    return REC_START_TAB;
  }

  if (MEMORY_PATTERNS.some((p) => lower.includes(p))) {
    return REC_RUN_MEMORY;
  }

  // Bare AbortError without cancel-modal hint is ambiguous; treat as
  // stream-level failure rather than assuming user intent.
  if (lower.includes("aborterror")) {
    return REC_START_STREAM;
  }

  // never a bare UNKNOWN: tag with the caller's errorType so it still names
  // the subsystem (e.g. UNKNOWN_STREAM_ERROR).
  return qualifyUnknown(errorType);
};

const qualifyUnknown = (errorType) => {
  const tag = String(errorType || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return tag ? `${UNKNOWN}_${tag}` : UNKNOWN;
};

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
