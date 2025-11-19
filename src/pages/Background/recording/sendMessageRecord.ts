import { sendMessageTab } from "../tabManagement";

import type { ExtensionMessage } from "../../../types/messaging";

export const sendMessageRecord = (
  message: ExtensionMessage,
  responseCallback: ((response: any) => void) | null = null
): Promise<any> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["recordingTab", "offscreen"], (result) => {
      if (chrome.runtime.lastError) {
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
      } else {
        sendMessageTab(result.recordingTab, message, responseCallback)
          .then(resolve)
          .catch(reject);
      }
    });
  });
};
