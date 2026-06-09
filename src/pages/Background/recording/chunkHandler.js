import localforage from "localforage";
import { sendMessageTab } from "../tabManagement";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

// in-memory promise chain. storage-based sendingChunks flag was racy:
// check-then-set via async chrome.storage let two concurrent triggers pass.
let _sendChain = Promise.resolve();

export const chunksStore = localforage.createInstance({ name: "chunks" });
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

    // editor reads chunks directly from IDB/OPFS via chooseReader; make-video-tab
    // just triggers that read (old per-chunk relay push removed)
    if (DEBUG_POSTSTOP)
      console.debug(
        "[Screenity][BG] instructing sandbox to make video tab",
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
