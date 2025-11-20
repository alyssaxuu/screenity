import { setContentState } from "../ContentState";

export const checkRecording = async (id: any): Promise<any> => {
  const { recording } = await chrome.storage.local.get("recording");
  const { tabRecordedID } = await chrome.storage.local.get("tabRecordedID");
  if (id == null && tabRecordedID) {
    setContentState((prevContentState) => ({
      ...prevContentState,
      recording: false,
    }));
  } else if (recording && tabRecordedID) {
    if (id != tabRecordedID) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        recording: false,
      }));
    }
  }
};
