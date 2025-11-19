import { sendMessageRecord } from "../recording/sendMessageRecord";
import type { ExtensionMessage } from "../../../types/messaging";

interface SetMicActiveRequest extends ExtensionMessage {
  active: boolean;
  defaultAudioInput?: string;
}

export const setMicActiveTab = async (request: SetMicActiveRequest): Promise<void> => {
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
