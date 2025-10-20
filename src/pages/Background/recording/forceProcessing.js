import { removeTab } from "../tabManagement";
import { sendChunks } from "./sendChunks";

export const forceProcessing = async () => {
  const editorURL = "editor.html";

  const { sandboxTab } = await chrome.storage.local.get(["sandboxTab"]);

  chrome.tabs.create(
    {
      url: editorURL,
      active: true,
    },
    (tab) => {
      chrome.tabs.onUpdated.addListener(function onTabUpdate(
        tabId,
        changeInfo
      ) {
        if (tabId === tab.id && changeInfo.status === "complete") {
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
