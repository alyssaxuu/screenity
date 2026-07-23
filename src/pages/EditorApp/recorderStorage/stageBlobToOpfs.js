// Stage a blob into OPFS so the background can read it by filename instead of
// receiving it as base64 over sendMessage. readAsDataURL + sendMessage
// materializes the whole file (~1.33x) and rejects past the message-size cap,
// which silently broke Drive save on large recordings. createWritable streams
// blob -> disk, so this stays memory-bounded at any size. Same OPFS transport
// the offscreen remux already uses (ContentState.remuxViaOffscreenOpfs).

const randomId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Writes `blob` to a uniquely named OPFS file and returns its name, or null if
// OPFS is unavailable or the write fails (caller falls back to base64). ext is
// without a dot, e.g. "mp4" / "webm".
export const stageBlobToOpfs = async (blob, ext = "mp4") => {
  if (!blob || typeof blob.size !== "number" || blob.size === 0) return null;
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.getDirectory !== "function"
  ) {
    return null;
  }
  const fileName = `drive-upload-${randomId()}.${ext}`;
  try {
    const dir = await navigator.storage.getDirectory();
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return fileName;
  } catch {
    // Best-effort cleanup of a partial file, then let the caller fall back.
    try {
      const dir = await navigator.storage.getDirectory();
      await dir.removeEntry(fileName).catch(() => {});
    } catch {}
    return null;
  }
};
