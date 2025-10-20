import localforage from "localforage";
import { blobToBase64 } from "../utils/blobToBase64";
import { sendMessageTab } from "../tabManagement";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

export const chunksStore = localforage.createInstance({
  name: "chunks",
});

export const localDirectoryStore = localforage.createInstance({
  name: "localDirectory",
});

export const clearAllRecordings = async () => {
  chunksStore.clear();
};

export const handleChunks = async (chunks, override = false) => {
  const { sendingChunks, sandboxTab, bannerSupport } =
    await chrome.storage.local.get([
      "sendingChunks",
      "sandboxTab",
      "bannerSupport",
    ]);

  if (sendingChunks) {
    console.warn("Chunks are already being sent, skipping...");
    return;
  }

  await chrome.storage.local.set({ sendingChunks: true });

  if (chunks.length === 0) {
    await chrome.storage.local.set({ sendingChunks: false });
    sendMessageTab(sandboxTab, { type: "make-video-tab", override });
    return;
  }

  chunks.sort((a, b) => a.timestamp - b.timestamp);

  const batchSize = 10;
  const maxRetries = 3;
  const retryDelay = 1000;
  const chunksCount = chunks.length;
  let currentIndex = 0;

  sendMessageTab(sandboxTab, {
    type: "chunk-count",
    count: chunksCount,
    override,
  });

  if (bannerSupport) {
    sendMessageTab(sandboxTab, { type: "banner-support" });
  }

  const sendBatch = async (batch, retryCount = 0) => {
    try {
      const response = await sendMessageTab(sandboxTab, {
        type: "new-chunk-tab",
        chunks: batch,
      });

      if (!response) {
        throw new Error("No response or failed response from tab.");
      }
    } catch (error) {
      if (retryCount < maxRetries) {
        console.error(
          `Sending batch failed, retrying... Attempt ${retryCount + 1}`,
          error
        );
        setTimeout(() => sendBatch(batch, retryCount + 1), retryDelay);
      } else {
        console.error("Maximum retry attempts reached for this batch.", error);
      }
    }
  };

  while (currentIndex < chunksCount) {
    const end = Math.min(currentIndex + batchSize, chunksCount);
    const batch = await Promise.all(
      chunks.slice(currentIndex, end).map(async (chunk, index) => {
        try {
          const base64 = await blobToBase64(chunk.chunk);
          return { chunk: base64, index: currentIndex + index };
        } catch (error) {
          console.error("Error converting chunk to Base64", error);
          return null;
        }
      })
    );

    const filteredBatch = batch.filter((chunk) => chunk !== null);
    if (filteredBatch.length > 0) {
      await sendBatch(filteredBatch);
    }
    currentIndex += batchSize;
  }

  await chrome.storage.local.set({ sendingChunks: false });
  sendMessageTab(sandboxTab, { type: "make-video-tab", override });
};

export const newChunk = async (request) => {
  const { sandboxTab } = await chrome.storage.local.get(["sandboxTab"]);
  sendMessageTab(sandboxTab, {
    type: "new-chunk-tab",
    chunk: request.chunk,
    index: request.index,
  });

  sendResponse({ status: "ok" });
};
