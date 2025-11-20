import { removeTab } from "../tabManagement";
import { sendChunks } from "./sendChunks";
import type { TabChangeInfo } from "../../../types/tabs";

export const forceProcessing = async (): Promise<void> => {
  const editorURL = "editor.html";

  const result = await chrome.storage.local.get(["sandboxTab"]);
  const sandboxTab = result.sandboxTab as number | undefined;

  chrome.tabs.create(
    {
      url: editorURL,
      active: true,
    },
    (tab) => {
      chrome.tabs.onUpdated.addListener(function onTabUpdate(
        tabId: number,
        changeInfo: TabChangeInfo,
        updatedTab: chrome.tabs.Tab
      ) {
        if (tab.id && tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(onTabUpdate);

          if (sandboxTab) {
            removeTab(sandboxTab);
          }

          chrome.storage.local.set({ sandboxTab: tab.id });

          sendChunks(true);
        }
      });
    }
  );
};
