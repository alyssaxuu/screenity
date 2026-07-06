// Recovery helper: resolve + download the current recording straight from its
// OPFS file, for when the editor's in-memory blob never loaded (orphaned pointer
// after an SW restart). READ-ONLY on OPFS (can't block a fresh recording or the
// 1-slot sweep), hands back the disk-backed File (O(1) memory), and won't return
// a file that's still being written.

const OPFS_RECORDING_PREFIX = "recording-";
const MIN_VALID_RECORDING_BYTES = 4096;
// Above this, the base64-via-background fallback would spike memory, so skip it.
// The disk-backed chrome.downloads path has no limit; the fallback is only for
// environments where blob-URL downloads are blocked (e.g. Brave).
const BASE64_FALLBACK_MAX_BYTES = 150_000_000;

const opfsAvailable = () =>
  typeof navigator !== "undefined" &&
  navigator.storage &&
  typeof navigator.storage.getDirectory === "function";

// Returns { name, handle, file } for the recording to recover, or null if
// none is recoverable, or { active: true } if a recording is currently being
// written (caller should not offer a raw download in that case).
export const resolveRecordingFile = async () => {
  if (!opfsAvailable()) return null;
  let dir;
  try {
    dir = await navigator.storage.getDirectory();
  } catch {
    return null;
  }

  let candidate = null;

  // 1) Fast path: the known pointer, if the file still exists and is valid.
  try {
    const { lastRecordingBackendRef } = await chrome.storage.local.get([
      "lastRecordingBackendRef",
    ]);
    const refName = lastRecordingBackendRef?.fileName;
    if (refName && refName.startsWith(OPFS_RECORDING_PREFIX)) {
      try {
        const handle = await dir.getFileHandle(refName);
        const file = await handle.getFile();
        if (file.size >= MIN_VALID_RECORDING_BYTES) {
          candidate = { name: refName, handle, file };
        }
      } catch {
        // NotFound / orphaned -> fall through to enumeration
      }
    }
  } catch {}

  // 2) Orphan fallback: newest valid recording-*.{mp4,webm}. With the 1-slot
  // model there is normally exactly one; we still pick the newest valid for
  // safety.
  if (!candidate) {
    const files = [];
    try {
      for await (const [name, handle] of dir.entries()) {
        if (!name.startsWith(OPFS_RECORDING_PREFIX)) continue;
        if (!name.endsWith(".mp4") && !name.endsWith(".webm")) continue;
        try {
          const file = await handle.getFile();
          if (file.size < MIN_VALID_RECORDING_BYTES) continue;
          files.push({ name, handle, file, lastModified: file.lastModified });
        } catch {}
      }
    } catch {
      return null;
    }
    if (!files.length) return null;
    files.sort((a, b) => b.lastModified - a.lastModified);
    candidate = files[0];
  }

  // Guard against handing back a file that's still being written (a fresh
  // recording in progress): a finished recording's size is stable.
  try {
    const size1 = candidate.file.size;
    await new Promise((r) => setTimeout(r, 600));
    const file2 = await candidate.handle.getFile();
    if (file2.size !== size1) {
      return { active: true };
    }
    candidate.file = file2;
  } catch {
    // file vanished mid-check (swept by a new recording) -> nothing to recover
    return null;
  }

  return candidate;
};

// Download a resolved recording File via chrome.downloads, streaming from disk.
// onResult(status) where status is "started" | "no-data" | "active" | "failed".
export const downloadResolvedRecording = async (titleBase, onResult) => {
  const resolved = await resolveRecordingFile();
  if (!resolved) {
    onResult?.("no-data");
    return;
  }
  if (resolved.active) {
    onResult?.("active");
    return;
  }
  const { file, name } = resolved;
  const ext = (file.type && file.type.includes("mp4")) || name.endsWith(".mp4")
    ? "mp4"
    : "webm";
  const safeBase =
    (titleBase || "screenity-recording")
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "screenity-recording";
  const filename = `${safeBase}.${ext}`;

  const fallbackViaBackground = async () => {
    // Only safe for small files: readAsDataURL materializes the whole file.
    if (file.size > BASE64_FALLBACK_MAX_BYTES) {
      onResult?.("failed");
      return;
    }
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      chrome.runtime.sendMessage({
        type: "request-download",
        base64,
        title: filename,
      });
      onResult?.("started");
    } catch {
      onResult?.("failed");
    }
  };

  let url = null;
  try {
    url = window.URL.createObjectURL(file);
    chrome.downloads.download({ url, filename }, (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        window.URL.revokeObjectURL(url);
        fallbackViaBackground();
        return;
      }
      onResult?.("started");
      const onChanged = (delta) => {
        if (delta.id !== downloadId || !delta.state) return;
        if (delta.state.current === "complete") {
          chrome.downloads.onChanged.removeListener(onChanged);
          window.URL.revokeObjectURL(url);
        } else if (delta.state.current === "interrupted") {
          chrome.downloads.onChanged.removeListener(onChanged);
          window.URL.revokeObjectURL(url);
          if (delta.error?.current !== "USER_CANCELED") fallbackViaBackground();
        }
      };
      chrome.downloads.onChanged.addListener(onChanged);
    });
  } catch {
    // download() threw synchronously (e.g. chrome.downloads unavailable) after
    // the URL was created; revoke it before falling back so it doesn't leak.
    if (url) {
      try {
        window.URL.revokeObjectURL(url);
      } catch {}
    }
    await fallbackViaBackground();
  }
};
