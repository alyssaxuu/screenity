import { MIME_TYPES } from "./recorderConfig";
import { canStartMp4Recorder } from "../utils/recorderCodec";

// Map a MediaRecorder mime to its container so the stored file's extension
// and the editor's <video> type match the bytes. mp4/quicktime = MP4, else WebM.
export const containerForMime = (mimeType) => {
  const m = String(mimeType || "").toLowerCase();
  return m.includes("mp4") || m.includes("quicktime") ? "mp4" : "webm";
};

// Pick the mime without building a recorder, so callers can learn the
// container up front (mirrors CloudRecorder's inspect/build split).
// Pass the capture stream where available: isTypeSupported can advertise MP4 on
// boxes whose MediaRecorder then throws from start(), which loses the recording.
export function selectRecorderMime(stream = null) {
  return (
    MIME_TYPES.find(
      (type) =>
        MediaRecorder.isTypeSupported(type) &&
        (!type.includes("mp4") || canStartMp4Recorder(stream, type)),
    ) || null
  );
}

export function createMediaRecorder(
  stream,
  { audioBitsPerSecond, videoBitsPerSecond }
) {
  const mimeType = selectRecorderMime(stream);

  if (!mimeType) {
    throw new Error("❌ No supported MIME types found");
  }

  const recorder = new MediaRecorder(stream, {
    mimeType,
    audioBitsPerSecond,
    videoBitsPerSecond,
  });
  // Carry our own container/mime: recorder.mimeType reflects it too, but the
  // browser can normalize the string.
  recorder.__screenityContainer = containerForMime(mimeType);
  recorder.__screenityMime = mimeType;
  // TEMP DEBUG (remove before commit): durable copy of the chosen mime so
  // mp4test() can read it even after the 500-entry lifecycle log rotates.
  try {
    chrome?.storage?.local?.set({
      __mp4dbg: { mime: mimeType, container: containerForMime(mimeType), at: Date.now() },
    });
  } catch {}
  return recorder;
}
