import localforage from "localforage";
import { blobToBase64 } from "../utils/blobToBase64";
import { sendMessageTab } from "../tabManagement";
import { diagEvent } from "../../utils/diagnosticLog";
import { perfMark, perfSpan } from "../../utils/perfMarks";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

// in-memory promise chain. storage-based sendingChunks flag was racy:
// check-then-set via async chrome.storage let two concurrent triggers pass.
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
  const priorChain = _sendChain;
  let releaseChain;
  _sendChain = new Promise((resolve) => {
    releaseChain = resolve;
  });
  try {
    await priorChain;
  } catch {}

  // outer try/finally guarantees lock release even if the storage read throws
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

  // legacy flag kept in sync for callers still reading it
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
    // sample first 3, last 3, ~every totalBatches/10 between; caps diag at ~10 events
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

      const endEncode = perfSpan("BG.chunkHandler batch-base64", {
        batchLen: rawBatch.length,
      });
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
      const totalBytes = batch.reduce(
        (s, b) => s + (b?.chunk?.length || 0),
        0,
      );
      endEncode({ totalBytes });

      const filtered = batch.filter(Boolean);
      if (filtered.length > 0) {
        const batchIndex = Math.floor(currentIndex / batchSize);
        if (DEBUG_POSTSTOP)
          console.debug("[Screenity][BG] sending filtered batch", {
            filteredLen: filtered.length,
            currentIndex,
          });
        const endSend = perfSpan("BG.chunkHandler batch-send", {
          batchLen: filtered.length,
          bytes: totalBytes,
        });
        const ok = await sendBatch(filtered);
        endSend({ ok });
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
