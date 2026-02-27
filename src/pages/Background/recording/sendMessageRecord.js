import { sendMessageTab } from "../tabManagement";

export const sendMessageRecord = (message, responseCallback = null) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["recordingTab", "offscreen"], (result) => {
      if (chrome.runtime.lastError) {
        console.warn(
          "sendMessageRecord: storage error",
          chrome.runtime.lastError.message
        );
        return reject(chrome.runtime.lastError.message);
      }

      if (result.offscreen) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else {
            responseCallback ? responseCallback(response) : resolve(response);
          }
        });
      } else if (result.recordingTab) {
        sendMessageTab(result.recordingTab, message, responseCallback)
          .then(resolve)
          .catch((err) => {
            console.warn(
              "sendMessageRecord: failed to message recordingTab",
              result.recordingTab,
              err
            );
            reject(err);
          });
      } else {
        // No recordingTab set - check if there's an active recorderSession
        // This can happen if the service worker restarted and lost in-memory state
        chrome.storage.local.get(["recorderSession"], (sessionResult) => {
          const recorderTabId =
            sessionResult.recorderSession?.recorderTabId ||
            sessionResult.recorderSession?.tabId ||
            null;
          if (sessionResult.recorderSession && recorderTabId) {
            // Try the tab from the persisted session
            sendMessageTab(recorderTabId, message, responseCallback)
              .then(resolve)
              .catch(reject);
          } else {
            console.warn(
              "sendMessageRecord: no recordingTab or recorderSession available"
            );
            reject(new Error("No recording tab available"));
          }
        });
      }
    });
  });
};
