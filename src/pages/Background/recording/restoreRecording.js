import { sendMessageTab } from "../tabManagement";
import { chunksStore } from "./chunkHandler";
import { sendChunks } from "./sendChunks";

export const checkRestore = async (sendResponse) => {
  const chunks = [];
  await chunksStore.iterate((value, key) => {
    chunks.push(value);
  });

  if (chunks.length === 0) {
    sendResponse({ restore: false, chunks: [] });
    return;
  }
  sendResponse({ restore: true });
};

export const restoreRecording = async () => {
  let editorUrl = "editorfallback.html";

  // Check if Chrome version is 109 or below
  if (navigator.userAgent.includes("Chrome/")) {
    const version = parseInt(navigator.userAgent.match(/Chrome\/([0-9]+)/)[1]);
    if (version > 109) {
      editorUrl = "editor.html";
    }
  }

  // Retrieve stored chunks
  const chunks = [];
  await chunksStore.iterate((value) => {
    chunks.push(value);
  });

  // If there are no chunks, return early
  if (chunks.length === 0) return;

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
            sendMessageTab(tab.id, {
              type: "restore-recording",
            });

            // Send stored chunks
            sendChunks();
            resolve();
          }
        });
      });
    }
  );
};
