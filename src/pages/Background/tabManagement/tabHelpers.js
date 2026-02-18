import { sendMessageRecord } from "../recording/sendMessageRecord";

export const setMicActiveTab = async (request) => {
  chrome.storage.local.get(["region"], (result) => {
    if (result.region) {
      sendMessageRecord({
        type: "set-mic-active-tab",
        active: request.active,
        defaultAudioInput: request.defaultAudioInput,
      }).catch((err) => {
        console.warn("Failed to send set-mic-active-tab to recorder:", err);
      });
    }
  });
};
