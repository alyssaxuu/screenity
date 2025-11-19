import { sendMessageTab } from "../tabManagement";
import { chunksStore } from "./chunkHandler";
import { supportsWebCodecs } from "../utils/featureDetection";

export const checkRestore = async (): Promise<{ restore: boolean; chunks?: any[] }> => {
  const chunks: any[] = [];
  await chunksStore.iterate((value: any) => {
    chunks.push(value);
  });

  if (chunks.length === 0) {
    return { restore: false, chunks: [] };
  }
  return { restore: true };
};

export const restoreRecording = async (): Promise<void> => {
  const hasWebCodecs = await supportsWebCodecs();

  let editorUrl: string;
  let messageType: string;

  if (hasWebCodecs) {
    editorUrl = "editorwebcodecs.html";
    messageType = "restore-recording";
  } else {
    editorUrl = "editorviewer.html";
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
      if (tab.id) {
        await new Promise<void>((resolve) => {
          chrome.tabs.onUpdated.addListener(function listener(
            tabId: number,
            info: { status?: string } | undefined
          ) {
            if (info?.status === "complete" && tabId === tab.id && tab.id) {
              chrome.tabs.onUpdated.removeListener(listener);

              setTimeout(() => {
                sendMessageTab(tab.id!, {
                  type: messageType,
                });
                resolve();
              }, 2000);
            }
          });
        });
      }
    }
  );
};
