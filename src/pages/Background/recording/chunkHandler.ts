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

export const clearAllRecordings = async (): Promise<void> => {
  try {
    await chunksStore.clear();
  } catch (err) {
    console.error("Failed to clear chunksStore", err);
  }
};

export const handleChunks = async (
  chunks: any[],
  override: boolean = false
): Promise<void> => {
  const result = await chrome.storage.local.get([
    "sendingChunks",
    "sandboxTab",
    "bannerSupport",
  ]);
  const sendingChunks = result.sendingChunks as boolean | undefined;
  const sandboxTab = result.sandboxTab as number | undefined;
  const bannerSupport = result.bannerSupport as boolean | undefined;

  if (sendingChunks || !sandboxTab) return;

  await chrome.storage.local.set({ sendingChunks: true });

  try {
    if (chunks.length === 0) {
      sendMessageTab(sandboxTab, { type: "make-video-tab", override } as ExtensionMessage);
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

    sendMessageTab(sandboxTab, {
      type: "chunk-count",
      count: chunks.length,
      override,
    } as ExtensionMessage);

    if (bannerSupport) {
      sendMessageTab(sandboxTab, { type: "banner-support" });
    }

    const delay = (ms: number): Promise<void> =>
      new Promise((res) => setTimeout(res, ms));

    const sendBatch = async (batch: any[]): Promise<boolean> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await sendMessageTab(sandboxTab, {
            type: "new-chunk-tab",
            chunks: batch,
          } as ExtensionMessage);
          if (response) return true;
        } catch (err) {}
        await delay(retryDelay);
      }
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
        })
      );

      const filtered = batch.filter(Boolean);
      if (filtered.length > 0) {
        const ok = await sendBatch(filtered);
        if (!ok) return;
      }

      currentIndex += batchSize;
    }

    sendMessageTab(sandboxTab, { type: "make-video-tab", override });
  } finally {
    await chrome.storage.local.set({ sendingChunks: false });
  }
};

import type { ExtensionMessage } from "../../../types/messaging";

export const newChunk = async (
  request: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { status: string; error?: string }) => void
): Promise<boolean> => {
  try {
    const result = await chrome.storage.local.get(["sandboxTab"]);
    const sandboxTab = result.sandboxTab as number | undefined;

    if (!sandboxTab) {
      sendResponse({ status: "error", error: "No sandbox tab" });
      return true;
    }

    await sendMessageTab(sandboxTab, {
      type: "new-chunk-tab",
      chunk: (request as any).chunk,
      index: (request as any).index,
    } as ExtensionMessage);

    sendResponse({ status: "ok" });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    sendResponse({ status: "error", error: error.message });
  }

  return true;
};
