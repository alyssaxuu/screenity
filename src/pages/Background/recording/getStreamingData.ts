export const getStreamingData = async (): Promise<any> => {
  try {
    const {
      micActive,
      defaultAudioInput,
      defaultAudioOutput,
      defaultVideoInput,
      systemAudio,
      recordingType,
    } = await chrome.storage.local.get([
      "micActive",
      "defaultAudioInput",
      "defaultAudioOutput",
      "defaultVideoInput",
      "systemAudio",
      "recordingType",
    ]);

    return {
      micActive,
      defaultAudioInput,
      defaultAudioOutput,
      defaultVideoInput,
      systemAudio,
      recordingType,
    };
  } catch (error) {
    console.error("Failed to retrieve streaming data:", error);
    return null;
  }
};
