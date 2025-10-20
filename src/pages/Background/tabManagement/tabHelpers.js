export const setMicActiveTab = async (request) => {
  chrome.storage.local.get(["region"], (result) => {
    if (result.region) {
      sendMessageRecord({
        type: "set-mic-active-tab",
        active: request.active,
        defaultAudioInput: request.defaultAudioInput,
      });
    }
  });
};
