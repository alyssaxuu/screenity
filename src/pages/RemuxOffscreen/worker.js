/*
 * Dedicated worker that re-muxes a fragmented MP4 file from OPFS to a
 * standard (non-fragmented) MP4, also written to OPFS. Keeps peak RAM
 * near zero regardless of recording length.
 *
 * Input and output are exchanged as OPFS filenames (strings) rather than
 * Blobs, because chrome.runtime.sendMessage across the service worker
 * loses Blob identity ("blob must be a Blob." errors). OPFS is shared
 * between the sandbox and the worker since both live at the same
 * chrome-extension origin.
 *
 * Flow:
 *   1. Sweep OPFS remux-*.mp4 files older than STALE_AGE_MS.
 *   2. Receive inputFileName + outputFileName from the offscreen doc.
 *   3. Open the input OPFS file, read as a Blob via getFile().
 *   4. Open the output OPFS file with a sync access handle.
 *   5. Run mediabunny Conversion (fastStart: false) streaming through
 *      a WritableStream backed by the sync handle.
 *   6. Flush + close the handle. Return the output filename.
 *   7. Caller (sandbox) reads the output from OPFS and triggers the
 *      download, then cleans up the input file. Output file lingers;
 *      the next run's sweep removes it.
 */
import {
  Input,
  Output,
  BlobSource,
  StreamTarget,
  Mp4OutputFormat,
  ALL_FORMATS,
  Conversion,
} from "mediabunny";
import { createOpfsWritable } from "./opfsTarget";

const TEMP_FILE_PREFIX = "remux-";
const STALE_AGE_MS = 5 * 60 * 1000;

const devLog =
  process.env.SCREENITY_DEV_MODE === "true"
    ? (label, data) => console.log("[remux][worker]", label, data || "")
    : () => {};

const postProgress = (requestId, progress) => {
  self.postMessage({ type: "progress", requestId, progress });
};

const postDone = (requestId, outputFileName) => {
  self.postMessage({ type: "done", requestId, outputFileName });
};

const postError = (requestId, error) => {
  self.postMessage({
    type: "error",
    requestId,
    error: String(error?.message || error),
  });
};

// Sweep stale remux-*.mp4 files from prior runs, but only those older than
// STALE_AGE_MS. Previous remuxes intentionally leave their file around so
// the sandbox can stream it to chrome.downloads without racing a delete;
// the age window is plenty for a download to complete.
const sweepOpfsStaleFiles = async () => {
  try {
    const dir = await navigator.storage.getDirectory();
    const now = Date.now();
    for await (const [name, handle] of dir.entries()) {
      if (!name.startsWith(TEMP_FILE_PREFIX)) continue;
      try {
        const file = await handle.getFile();
        if (now - file.lastModified > STALE_AGE_MS) {
          await dir.removeEntry(name).catch(() => {});
        }
      } catch {
        // Unable to stat the file; leave it alone.
      }
    }
  } catch {
    // best-effort
  }
};

const remuxToOpfs = async ({ requestId, inputFileName, outputFileName }) => {
  const startedAt = Date.now();
  devLog("start", { requestId, inputFileName, outputFileName });
  await sweepOpfsStaleFiles();

  let dir;
  let outputHandle;
  let syncHandle;
  let handleReleased = false;
  let lastProgressLogged = -1;

  try {
    dir = await navigator.storage.getDirectory();

    // Load the input as a Blob via getFile(). The Blob is disk-backed by
    // Chrome; reads during mediabunny's processing stream from the OPFS
    // file on demand without pulling all bytes into memory at once.
    const inputHandle = await dir.getFileHandle(inputFileName);
    const inputFile = await inputHandle.getFile();

    outputHandle = await dir.getFileHandle(outputFileName, { create: true });
    syncHandle = await outputHandle.createSyncAccessHandle();
    syncHandle.truncate(0);

    const writable = createOpfsWritable(syncHandle);

    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(inputFile),
    });
    const output = new Output({
      target: new StreamTarget(writable),
      format: new Mp4OutputFormat({ fastStart: false }),
    });

    const conversion = await Conversion.init({
      input,
      output,
      video: { forceTranscode: false },
      audio: { forceTranscode: false },
    });
    conversion.onProgress = (p) => {
      postProgress(requestId, p);
      const decile = Math.floor(p * 10);
      if (decile !== lastProgressLogged) {
        lastProgressLogged = decile;
        devLog("progress", { pct: Math.round(p * 100) });
      }
    };
    await conversion.execute();

    try {
      await writable.close();
    } catch {
      // close is best-effort; the sync handle already has the data.
    }
    syncHandle.flush();
    const finalSize = syncHandle.getSize();
    syncHandle.close();
    handleReleased = true;

    devLog("done", {
      durationMs: Date.now() - startedAt,
      outputBytes: finalSize,
    });
    postDone(requestId, outputFileName);
  } catch (err) {
    devLog("error", {
      err: String(err?.message || err).slice(0, 200),
      durationMs: Date.now() - startedAt,
    });
    postError(requestId, err);
    if (syncHandle && !handleReleased) {
      try {
        syncHandle.close();
      } catch {
        // already closed
      }
    }
    if (dir && outputFileName) {
      try {
        await dir.removeEntry(outputFileName).catch(() => {});
      } catch {
        // best-effort
      }
    }
  }
};

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg || msg.type !== "remux") return;
  remuxToOpfs(msg);
};
