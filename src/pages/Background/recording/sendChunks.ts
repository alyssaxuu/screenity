import { chunksStore } from "./chunkHandler";
import { handleChunks } from "./chunkHandler";

export const sendChunks = async (override: boolean = false): Promise<void> => {
  try {
    const chunks: any[] = [];
    await chunksStore.iterate((value: any) => {
      chunks.push(value);
    });
    handleChunks(chunks, override);
  } catch (error) {
    console.error("Failed to send chunks. Reloading extension.", error);
    chrome.runtime.reload();
  }
};
