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
            const errStr = String(err);
            const isDeadTab =
              errStr.includes("Receiving end does not exist") ||
              errStr.includes("No tab with id");
            console.warn(
              `sendMessageRecord: failed to message recordingTab ${result.recordingTab}${isDeadTab ? " (stale/dead tab)" : ""}`,
              err
            );
            reject(err);
          });
      } else {
        // SW restart can lose recordingTab, fall back to recorderSession
        // but only if it's still live. completed/crashed/stopped sessions
        // point at a dead tab and would surface a misleading "No tab with
        // id" error instead of the real "no recorder tab" one.
        chrome.storage.local.get(["recorderSession"], (sessionResult) => {
          const session = sessionResult.recorderSession;
          const recorderTabId =
            session?.recorderTabId || session?.tabId || null;
          const sessionLive =
            session?.status === "recording" || session?.status === "starting";
          if (sessionLive && recorderTabId) {
            sendMessageTab(recorderTabId, message, responseCallback)
              .then(resolve)
              .catch(reject);
          } else {
            console.warn(
              "sendMessageRecord: no recording tab available",
              session
                ? { sessionStatus: session.status, recorderTabId }
                : { session: null }
            );
            reject(new Error("No recording tab available"));
          }
        });
      }
    });
  });
};
