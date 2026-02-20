import { sendMessageTab } from "../tabManagement";
import { chunksStore } from "./chunkHandler";

export const checkRestore = async () => {
  const chunks = [];
  await chunksStore.iterate((value, key) => {
    chunks.push(value);
  });

  if (chunks.length === 0) {
    return { restore: false, chunks: [] };
  }
  return { restore: true };
};

export const restoreRecording = async () => {
  const { fastRecorderInUse } = await chrome.storage.local.get([
    "fastRecorderInUse",
  ]);
  //const hasWebCodecs = supportsWebCodecs();
  const hasWebCodecs = Boolean(fastRecorderInUse);

  let editorUrl, messageType;

  if (hasWebCodecs) {
    editorUrl = "editorwebcodecs.html?mode=recover";
    messageType = "restore-recording";
  } else {
    editorUrl = "editorviewer.html?mode=recover";
    messageType = "viewer-recording";
  }

  const chunks = [];
  await chunksStore.iterate((value) => {
    chunks.push(value);
  });

  if (chunks.length === 0) {
    return;
  }

  // Create the editor tab
  chrome.tabs.create(
    {
      url: editorUrl,
      active: true,
    },
    async (tab) => {
      // Save the tab ID in local storage
      chrome.storage.local.set({ sandboxTab: tab.id });

      // Wait for the tab to load before sending messages
      await new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (info.status === "complete" && tabId === tab.id) {
            chrome.tabs.onUpdated.removeListener(listener);

            setTimeout(() => {
              sendMessageTab(tab.id, {
                type: messageType,
              });
              resolve();
            }, 2000);
          }
        });
      });
    }
  );
};
