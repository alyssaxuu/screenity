import localforage from "localforage";
import { blobToBase64 } from "../utils/blobToBase64";
import { sendMessageTab } from "../tabManagement";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

export const chunksStore = localforage.createInstance({ name: "chunks" });
export const localDirectoryStore = localforage.createInstance({
  name: "localDirectory",
});
const DEBUG_POSTSTOP = true;

export const clearAllRecordings = async () => {
  try {
    await chunksStore.clear();
  } catch (err) {
    console.error("Failed to clear chunksStore", err);
  }
};

export const handleChunks = async (chunks, override = false, target = null) => {
  const { sendingChunks, sandboxTab, bannerSupport } =
    await chrome.storage.local.get([
      "sendingChunks",
      "sandboxTab",
      "bannerSupport",
    ]);

  if (DEBUG_POSTSTOP)
    console.debug("[Screenity][BG] handleChunks called", {
      chunksLength: chunks?.length,
      sandboxTab,
      override,
    });

  if (sendingChunks) return;

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
        if (DEBUG_POSTSTOP)
          console.debug("[Screenity][BG] sending filtered batch", {
            filteredLen: filtered.length,
            currentIndex,
          });
        const ok = await sendBatch(filtered);
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
