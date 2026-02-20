import { chunksStore } from "./chunkHandler";
import { handleChunks } from "./chunkHandler";

export const sendChunks = async (override = false) => {
  try {
    // Wait briefly for chunks to be flushed to IndexedDB
    const maxAttempts = 15;
    const delayMs = 200;
    let chunkCount = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      chunkCount = 0;
      await chunksStore.iterate(() => {
        chunkCount += 1;
      });
      if (chunkCount > 0) break;
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const chunks = [];
    await chunksStore.iterate((value) => {
      chunks.push(value);
    });
    handleChunks(chunks, override);
  } catch (error) {
    console.error("Failed to send chunks. Reloading extension.", error);
    chrome.runtime.reload();
  }
};
