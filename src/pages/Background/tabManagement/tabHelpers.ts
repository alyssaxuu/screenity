import { sendMessageRecord } from "../recording/sendMessageRecord";
import type { ExtensionMessage } from "../../../types/messaging";

interface SetMicActiveRequest {
  type: string;
  active: boolean;
  defaultAudioInput?: string;
  [key: string]: any;
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
