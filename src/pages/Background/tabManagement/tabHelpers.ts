import { sendMessageRecord } from "../recording/sendMessageRecord";
import type { SetMicActiveMessage } from "../../../types/messaging";

export const setMicActiveTab = async (request: SetMicActiveMessage): Promise<void> => {
  chrome.storage.local.get(["region"], (result) => {
    const region = result.region as boolean | undefined;
    if (region) {
      sendMessageRecord({
        type: "set-mic-active-tab",
        active: request.active,
        defaultAudioInput: request.defaultAudioInput,
      });
    }
  });
};
