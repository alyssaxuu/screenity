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
// don't give up while a huge file is still flushing past the 60s timeout;
// only stop once growth stalls, capped here.
const FINALIZE_ABSOLUTE_TIMEOUT_MS = 300_000;
// don't flash the "finalizing" UI for the common <1s case
const SLOW_FINALIZE_NOTIFY_MS = 600;

const diagForward = (event, data) => {
  try {
    chrome.runtime
      .sendMessage({ type: "diag-forward", event, data })
      .catch(() => {});
  } catch {}
};

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

    let notified = false;
    const notifySlow = () => {
      if (notified) return;
      notified = true;
      try {
        onSlowFinalize?.();
      } catch {}
    };

    // the writer creates the file before the ref, so a NotFoundError here
    // means it was deleted, not a create race. fail fast instead of polling.
    let handle;
    try {
      handle = await dir.getFileHandle(this._fileName);
    } catch (err) {
      if (err?.name === "NotFoundError") {
        diagForward("sandbox-opfs-handle-missing", { fileName: this._fileName });
      }
      throw err;
    }

    let { sameFile, finalized } = await this._readRefState();

    // !sameFile means a newer recording replaced the ref (our writer is
    // gone, or we're opening an orphan file). sameFile && finalized means
    // the writer closed cleanly. otherwise wait for one of those — but
    // also watch the file size: if the writer dies without emitting the
    // finalized marker (recorder tab killed, SW restart mid-flush, track
    // ended mid-write), polling will time out at 60s for no reason. When
    // size has been stable for SIZE_STABLE_MS, treat the writer as gone
    // and read what's on disk.
    if (sameFile && !finalized) {
      const startedAt = Date.now();
      let timedOut = false;
      let lastSize = -1;
      let sizeStableSince = 0;
      const SIZE_STABLE_MS = 3000;
      const SIZE_STABLE_MIN_WAIT_MS = 1500;
      let writerDead = false;
      while (true) {
        const elapsed = Date.now() - startedAt;
        // only time out once the size stops changing; a still-growing file
        // keeps waiting up to the ceiling.
        const growthStalled =
          sizeStableSince > 0 && Date.now() - sizeStableSince >= SIZE_STABLE_MS;
        if (
          elapsed > FINALIZE_HARD_TIMEOUT_MS &&
          (growthStalled || elapsed > FINALIZE_ABSOLUTE_TIMEOUT_MS)
        ) {
          timedOut = true;
          break;
        }
        if (!notified && elapsed > SLOW_FINALIZE_NOTIFY_MS) {
          notifySlow();
        }
        await wait(FINALIZE_POLL_INTERVAL_MS);
        ({ sameFile, finalized } = await this._readRefState());
        if (finalized || !sameFile) break;
        // Size-stability check. Probing the file inside the poll loop is
        // cheap — getFile is metadata only on chromium.
        try {
          const probe = await handle.getFile();
          if (probe.size !== lastSize) {
            lastSize = probe.size;
            sizeStableSince = Date.now();
          } else if (
            sizeStableSince > 0 &&
            Date.now() - sizeStableSince >= SIZE_STABLE_MS &&
            Date.now() - startedAt >= SIZE_STABLE_MIN_WAIT_MS &&
            probe.size >= MIN_VALID_RECORDING_BYTES
          ) {
            writerDead = true;
            break;
          }
        } catch {}
      }
      if (timedOut || writerDead) {
        try {
          chrome.runtime
            .sendMessage({
              type: "diag-forward",
              event: writerDead
                ? "sandbox-opfs-writer-dead-detected"
                : "sandbox-opfs-wait-finalize-timeout",
              data: {
                fileName: this._fileName,
                waitedMs: Date.now() - startedAt,
                fileBytes: lastSize >= 0 ? lastSize : null,
              },
            })
            .catch(() => {});
        } catch {}
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
    const isWebm = /\.webm$/i.test(this._fileName || "");
    const blob = new Blob([file], {
      type: isWebm ? "video/webm" : "video/mp4",
    });
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
