import { sendMessageTab } from "../tabManagement";

export const requestDownload = async (base64, title) => {
  try {
    // Open a new tab with the download page
    const tab = await chrome.tabs.create({
      url: "download.html",
      active: false,
    });

    // Add a listener for when the tab finishes loading
    const listener = (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.status === "complete") {
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
    console.error("Failed to request download:", error.message);
  }
};

export const downloadIndexedDB = async () => {
  try {
    // Open a new tab with the download page
    const tab = await chrome.tabs.create({
      url: "download.html",
      active: false,
    });

    // Add a listener for when the tab finishes loading
    const listener = (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);

        // Send the message to trigger the IndexedDB download
        sendMessageTab(tab.id, {
          type: "download-indexed-db",
        });
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  } catch (error) {
    console.error("Failed to initiate IndexedDB download:", error.message);
  }
};
