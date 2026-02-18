import { MIME_TYPES } from "./recorderConfig";

export function createMediaRecorder(
  stream,
  { audioBitsPerSecond, videoBitsPerSecond, mimeType: mimeTypeOverride }
) {
  const mimeType =
    mimeTypeOverride ||
    MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));

  if (!mimeType) {
    throw new Error("❌ No supported MIME types found");
  }

  return new MediaRecorder(stream, {
    mimeType,
    audioBitsPerSecond,
    videoBitsPerSecond,
  });
}
