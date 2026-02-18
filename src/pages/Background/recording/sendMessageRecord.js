import { sendMessageTab } from "../tabManagement";

let missingRecordingTabLogged = false;

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
          .then((res) => {
            missingRecordingTabLogged = false;
            resolve(res);
          })
          .catch((err) => {
            if (!missingRecordingTabLogged) {
              missingRecordingTabLogged = true;
              console.warn(
                "sendMessageRecord: recordingTab unavailable, stopping retries",
                result.recordingTab,
                err
              );
            }
            reject(err);
          });
      } else {
        // No recordingTab set - check if there's an active recorderSession
        // This can happen if the service worker restarted and lost in-memory state
        chrome.storage.local.get(["recorderSession"], (sessionResult) => {
          if (
            sessionResult.recorderSession &&
            sessionResult.recorderSession.tabId
          ) {
            // Try the tab from the persisted session
            sendMessageTab(
              sessionResult.recorderSession.tabId,
              message,
              responseCallback
            )
              .then((res) => {
                missingRecordingTabLogged = false;
                resolve(res);
              })
              .catch((err) => {
                if (!missingRecordingTabLogged) {
                  missingRecordingTabLogged = true;
                  console.warn(
                    "sendMessageRecord: recorderSession tab unavailable, stopping retries",
                    sessionResult.recorderSession.tabId,
                    err
                  );
                }
                reject(err);
              });
          } else {
            if (!missingRecordingTabLogged) {
              missingRecordingTabLogged = true;
              console.warn(
                "sendMessageRecord: no recordingTab or recorderSession available"
              );
            }
            reject(new Error("No recording tab available"));
          }
        });
      }
    });
  });
};
