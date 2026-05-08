// 4 KB rejects empty/header-only files without blocking 2-3s legit clips
// (MP4 ftyp box alone is 28 bytes).
export const MIN_VALID_RECORDING_BYTES = 4096;

// editor can open before the writer's final flush lands (muxer trailer
// + moov can take hundreds of ms, or seconds on huge recordings). reading
// mid-flush produces a truncated blob, so wait for the writer to set
// lastRecordingFinalizedFileName, or for the backend ref to be replaced
// by a newer recording (which means our writer is gone).
const FINALIZE_POLL_INTERVAL_MS = 250;
const FINALIZE_HARD_TIMEOUT_MS = 60_000;
// don't flash the "finalizing" UI for the common <1s case
const SLOW_FINALIZE_NOTIFY_MS = 600;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class OpfsChunkReader {
  constructor() {
    this._fileName = null;
    this._opened = false;
  }

  async open(backendRef) {
    const name = backendRef?.fileName;
    if (!name) {
      throw new Error("opfs-chunk-reader-no-filename");
    }
    this._fileName = name;
    this._opened = true;
  }

  async _readRefState() {
    try {
      const { lastRecordingBackendRef, lastRecordingFinalizedFileName } =
        await chrome.storage.local.get([
          "lastRecordingBackendRef",
          "lastRecordingFinalizedFileName",
        ]);
      return {
        sameFile: lastRecordingBackendRef?.fileName === this._fileName,
        finalized: lastRecordingFinalizedFileName === this._fileName,
      };
    } catch {
      return { sameFile: false, finalized: false };
    }
  }

  async readBlob({ onSlowFinalize } = {}) {
    if (!this._opened) {
      throw new Error("opfs-chunk-reader-not-opened");
    }
    const dir = await navigator.storage.getDirectory();
    const handle = await dir.getFileHandle(this._fileName);

    let { sameFile, finalized } = await this._readRefState();

    // !sameFile means a newer recording replaced the ref (our writer is
    // gone, or we're opening an orphan file). sameFile && finalized means
    // the writer closed cleanly. otherwise wait for one of those.
    if (sameFile && !finalized) {
      const startedAt = Date.now();
      let notified = false;
      while (true) {
        if (Date.now() - startedAt > FINALIZE_HARD_TIMEOUT_MS) break;
        if (!notified && Date.now() - startedAt > SLOW_FINALIZE_NOTIFY_MS) {
          try {
            onSlowFinalize?.();
          } catch {}
          notified = true;
        }
        await wait(FINALIZE_POLL_INTERVAL_MS);
        ({ sameFile, finalized } = await this._readRefState());
        if (finalized || !sameFile) break;
      }
    }

    const file = await handle.getFile();
    if (file.size < MIN_VALID_RECORDING_BYTES) {
      const err = new Error(
        `opfs-file-too-small: ${file.size} bytes < ${MIN_VALID_RECORDING_BYTES}`,
      );
      err.code = "opfs-file-too-small";
      throw err;
    }
    const blob = new Blob([file], { type: "video/mp4" });
    return {
      blob,
      byteSize: blob.size,
      chunkCount: 1,
    };
  }

  async close() {
    this._opened = false;
  }
}
