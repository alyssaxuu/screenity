// Capture asks for video and audio in one mandatory request, so an audio
// endpoint that won't start takes the video down with it and no recording
// begins. Reported on Windows as NotReadableError "Could not start audio
// source". Pure predicates (unit-tested in tests/unit/).

// Windows loopback fails this way when the endpoint is gone or held exclusively.
const AUDIO_SOURCE_ERROR_NAMES = ["NotReadableError", "NotFoundError"];

const AUDIO_SOURCE_ERROR_PATTERNS = [
  "could not start audio source",
  "audio capture failed",
  "failed to start audio",
  "invalid audio",
];

// bareNameCounts trusts a message-less NotReadableError as an audio failure.
// Only desktopCapture passes it, where the retry is silent. On getDisplayMedia
// a wrong guess reopens the picker and blames audio for a dead video source.
export const isCaptureAudioSourceError = (err, { bareNameCounts = false } = {}) => {
  const name = String(err?.name || "");
  // Only a string err is worth stringifying: String(err) on an Error object
  // gives "[object Object]", which is neither empty nor a readable message.
  const raw = err?.message ?? (typeof err === "string" ? err : "");
  const message = String(raw).toLowerCase();
  if (AUDIO_SOURCE_ERROR_PATTERNS.some((p) => message.includes(p))) return true;
  if (!bareNameCounts) return false;
  return (
    AUDIO_SOURCE_ERROR_NAMES.includes(name) &&
    !message.includes("video") &&
    message.trim() === ""
  );
};

// canRequestAudioTrack:false means the picked surface has no capturable audio
// (window on Windows). Tab audio is always asked for: the playback relay needs
// it. The desktop loopback is only ever mixed when systemAudio is on.
export const shouldRequestCaptureAudio = ({
  isTab = false,
  systemAudio = false,
  canRequestAudioTrack,
} = {}) => {
  if (canRequestAudioTrack === false) return false;
  return Boolean(isTab || systemAudio);
};
