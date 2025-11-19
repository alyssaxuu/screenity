import { sendMessageTab } from "../tabManagement";

export const requestDownload = async (base64: string, title: string): Promise<void> => {
  try {
    // Open a new tab with the download page
    const tab = await chrome.tabs.create({
      url: "download.html",
      active: false,
    });

    // Add a listener for when the tab finishes loading
    const listener = (tabId: number, changeInfo: { status?: string } | undefined) => {
      if (tabId === tab.id && changeInfo?.status === "complete" && tab.id) {
        chrome.tabs.onUpdated.removeListener(listener);

        // Send the message with the download data
        sendMessageTab(tab.id, {
          type: "download-video",
          base64,
          title,
        });
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to request download:", err.message);
  }
};

export const downloadIndexedDB = async (): Promise<void> => {
  try {
    // Open a new tab with the download page
    const tab = await chrome.tabs.create({
      url: "download.html",
      active: false,
    });

    // Add a listener for when the tab finishes loading
    const listener = (tabId: number, changeInfo: { status?: string } | undefined) => {
      if (tabId === tab.id && changeInfo?.status === "complete" && tab.id) {
        chrome.tabs.onUpdated.removeListener(listener);

        // Send the message to trigger the IndexedDB download
        sendMessageTab(tab.id, {
          type: "download-indexed-db",
        });
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to initiate IndexedDB download:", err.message);
  }
};
