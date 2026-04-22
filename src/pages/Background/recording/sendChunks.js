import { chunksStore } from "./chunkHandler";
import { handleChunks } from "./chunkHandler";
import { diagEvent } from "../../utils/diagnosticLog";

export const sendChunks = async (override = false, target = null) => {
  const startedAt = Date.now();
  try {
    // Wait briefly for chunks to be flushed to IndexedDB
    const maxAttempts = 50;
    const delayMs = 200;
    let chunkCount = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      chunkCount = 0;
      await chunksStore.iterate(() => {
        chunkCount += 1;
      });
      console.debug("[Screenity][BG] sendChunks: chunkCount check", {
        attempt,
        chunkCount,
      });
      if (chunkCount > 0) break;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    diagEvent("sw-sendchunks-start", {
      initialCount: chunkCount,
      override: Boolean(override),
      targetTabId: target?.tabId ?? null,
    });

    if (chunkCount === 0) {
      console.warn(
        "[Screenity][BG] sendChunks: no chunks available after waiting",
      );
      try {
        await chrome.storage.local.set({
          lastChunkSendFailure: {
            ts: Date.now(),
            why: "no-chunks-after-wait",
            override,
            targetTabId: target?.tabId ?? null,
          },
        });
      } catch {}
      diagEvent("chunks-fail", { why: "no-chunks-after-wait" });
      return { status: "empty", chunkCount: 0 };
    }

    const chunks = [];
    await chunksStore.iterate((value) => {
      chunks.push(value);
    });
    console.debug("[Screenity][BG] sendChunks: collected chunks", {
      count: chunks.length,
    });
    // Await handleChunks to ensure messaging completes before returning
    await handleChunks(chunks, override, target);
    diagEvent("chunks-sent", { count: chunks.length });
    diagEvent("sw-sendchunks-done", {
      totalSent: chunks.length,
      elapsedMs: Date.now() - startedAt,
    });
    return { status: "ok", chunkCount: chunks.length };
  } catch (error) {
    diagEvent("sw-sendchunks-error", {
      error: String(error?.message || error).slice(0, 200),
      elapsedMs: Date.now() - startedAt,
    });
    console.error("Failed to send chunks. Reloading extension.", error);
    chrome.runtime.reload();
  }
};
