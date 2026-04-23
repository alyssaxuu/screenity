import localforage from "localforage";
import { blobToBase64 } from "../utils/blobToBase64";
import { sendMessageTab } from "../tabManagement";
import { diagEvent } from "../../utils/diagnosticLog";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

// In-memory lock for handleChunks. The previous storage-based `sendingChunks`
// flag was check-then-set via async chrome.storage calls — two concurrent
// handleChunks triggers (one from the recorder's stop flow, one from the
// sandbox's send-chunks-to-sandbox request) could both pass the check before
// either wrote the flag. That caused duplicate batches to interleave at the
// sandbox and scramble chunk order. An in-process promise chain is atomic in
// the SW event loop and strictly serializes handleChunks calls.
let _sendChain = Promise.resolve();

export const chunksStore = localforage.createInstance({ name: "chunks" });
export const localDirectoryStore = localforage.createInstance({
  name: "localDirectory",
});
const DEBUG_POSTSTOP = false;

export const clearAllRecordings = async () => {
  try {
    await chunksStore.clear();
  } catch (err) {
    console.error("Failed to clear chunksStore", err);
  }
};

export const handleChunks = async (chunks, override = false, target = null) => {
  // Serialize via in-memory promise chain. Atomic in the SW event loop, so
  // two concurrent triggers (e.g. the automatic send on stop and the
  // sandbox's `send-chunks-to-sandbox` request) run back-to-back instead of
  // overlapping. Prevents duplicate batches from interleaving at the sandbox
  // and scrambling chunk order. The old storage-based `sendingChunks` flag
  // is racy — async read + async write leaves a gap where both callers pass.
  const priorChain = _sendChain;
  let releaseChain;
  _sendChain = new Promise((resolve) => {
    releaseChain = resolve;
  });
  try {
    await priorChain;
  } catch {}

  // From here down, any early return or throw must still release the lock.
  // The inner try/finally below covers the main body; this wrapper catches
  // anything before it (e.g. a failing storage read).
  let mainCompleted = false;
  try {
  const { sandboxTab, bannerSupport } = await chrome.storage.local.get([
    "sandboxTab",
    "bannerSupport",
  ]);

  if (DEBUG_POSTSTOP)
    console.debug("[Screenity][BG] handleChunks called", {
      chunksLength: chunks?.length,
      sandboxTab,
      override,
    });

  // Keep the legacy storage flag in sync for anything still reading it.
  await chrome.storage.local.set({ sendingChunks: true });

  try {
    if (!Array.isArray(chunks) || chunks.length === 0) {
      if (DEBUG_POSTSTOP)
        console.debug("[Screenity][BG] no chunks to send; deferring delivery");
      return;
    }

    chunks.sort((a, b) => {
      if (a.index == null) return -1;
      if (b.index == null) return 1;
      return a.index - b.index;
    });

    const batchSize = 10;
    const maxRetries = 3;
    const retryDelay = 1000;

    const targetTab = target?.tabId || sandboxTab;
    const targetFrame = target?.frameId ?? null;

    if (DEBUG_POSTSTOP)
      console.debug("[Screenity][BG] sending chunk-count", {
        count: chunks.length,
        targetTab,
        targetFrame,
        override,
      });

    const sendToTarget = (msg) =>
      new Promise((resolve, reject) => {
        try {
          if (targetTab == null) return reject(new Error("no-target-tab"));
          if (typeof targetFrame === "number") {
            chrome.tabs.sendMessage(
              targetTab,
              msg,
              { frameId: targetFrame },
              (resp) => {
                if (chrome.runtime.lastError)
                  return reject(chrome.runtime.lastError.message);
                resolve(resp);
              },
            );
          } else {
            sendMessageTab(targetTab, msg, null).then(resolve).catch(reject);
          }
        } catch (err) {
          reject(err);
        }
      });

    try {
      await sendToTarget({
        type: "chunk-count",
        count: chunks.length,
        override,
      });
    } catch (err) {
      if (DEBUG_POSTSTOP)
        console.warn("[Screenity][BG] chunk-count message failed", err);
    }

    if (bannerSupport) {
      try {
        await sendToTarget({ type: "banner-support" });
      } catch (err) {
        if (DEBUG_POSTSTOP)
          console.warn("[Screenity][BG] banner-support message failed", err);
      }
    }

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    const sendBatch = async (batch) => {
      let attempt = 0;
      while (attempt < maxRetries) {
        attempt += 1;
        try {
          if (DEBUG_POSTSTOP)
            console.debug("[Screenity][BG] sending new-chunk-tab batch", {
              batchLen: batch.length,
              attempt,
            });
          await sendToTarget({ type: "new-chunk-tab", chunks: batch });
          return true;
        } catch (err) {
          if (DEBUG_POSTSTOP)
            console.warn("[Screenity][BG] sendBatch attempt failed, retrying", {
              attempt,
              err,
            });
          if (attempt < maxRetries) await delay(retryDelay);
        }
      }
      if (DEBUG_POSTSTOP)
        console.warn("[Screenity][BG] sendBatch failed after retries");
      return false;
    };

    let currentIndex = 0;
    // Sample first 3, last 3, every ~totalBatches/10 between - caps at ~10 diag events.
    const totalBatches = Math.max(1, Math.ceil(chunks.length / batchSize));
    const sampleStride = Math.max(1, Math.floor(totalBatches / 10));
    const shouldEmitBatch = (batchIndex) => {
      if (batchIndex < 3) return true;
      if (batchIndex >= totalBatches - 3) return true;
      return batchIndex % sampleStride === 0;
    };

    while (currentIndex < chunks.length) {
      const end = Math.min(currentIndex + batchSize, chunks.length);
      const rawBatch = chunks.slice(currentIndex, end);

      const batch = await Promise.all(
        rawBatch.map(async (chunk) => {
          try {
            const base64 = await blobToBase64(chunk.chunk);
            return { chunk: base64, index: chunk.index };
          } catch {
            return null;
          }
        }),
      );

      const filtered = batch.filter(Boolean);
      if (filtered.length > 0) {
        const batchIndex = Math.floor(currentIndex / batchSize);
        if (DEBUG_POSTSTOP)
          console.debug("[Screenity][BG] sending filtered batch", {
            filteredLen: filtered.length,
            currentIndex,
          });
        const ok = await sendBatch(filtered);
        if (shouldEmitBatch(batchIndex)) {
          diagEvent("sw-sendchunks-batch", {
            batchIndex,
            totalBatches,
            batchSize: filtered.length,
            ok,
          });
        }
        if (!ok) {
          if (DEBUG_POSTSTOP)
            console.warn("[Screenity][BG] failed to send batch, aborting");
          return;
        }
      }

      currentIndex += batchSize;
    }

    if (DEBUG_POSTSTOP)
      console.debug(
        "[Screenity][BG] all batches sent, instructing sandbox to make video tab",
        { sandboxTab: targetTab },
      );
    try {
      await sendToTarget({ type: "make-video-tab", override });
    } catch (err) {
      if (DEBUG_POSTSTOP)
        console.warn("[Screenity][BG] make-video-tab message failed", err);
    }
  } finally {
    await chrome.storage.local.set({ sendingChunks: false });
    mainCompleted = true;
  }
  } finally {
    // Release the in-memory lock so queued callers can proceed, regardless of
    // whether the inner body completed normally.
    void mainCompleted;
    if (releaseChain) releaseChain();
  }
};

export const newChunk = async (request, sender, sendResponse) => {
  try {
    const { sandboxTab } = await chrome.storage.local.get(["sandboxTab"]);

    await sendMessageTab(sandboxTab, {
      type: "new-chunk-tab",
      chunk: request.chunk,
      index: request.index,
    });

    sendResponse({ status: "ok" });
  } catch (err) {
    sendResponse({ status: "error", error: err.message });
  }

  return true;
};
