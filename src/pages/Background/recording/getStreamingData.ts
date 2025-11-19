interface StreamingData {
  micActive?: boolean;
  defaultAudioInput?: string;
  defaultAudioOutput?: string;
  defaultVideoInput?: string;
  systemAudio?: boolean;
  recordingType?: string;
}

export const getStreamingData = async (): Promise<StreamingData | null> => {
  try {
    const result = await chrome.storage.local.get([
      "micActive",
      "defaultAudioInput",
      "defaultAudioOutput",
      "defaultVideoInput",
      "systemAudio",
      "recordingType",
    ]);

    return {
      micActive: result.micActive as boolean | undefined,
      defaultAudioInput: result.defaultAudioInput as string | undefined,
      defaultAudioOutput: result.defaultAudioOutput as string | undefined,
      defaultVideoInput: result.defaultVideoInput as string | undefined,
      systemAudio: result.systemAudio as boolean | undefined,
      recordingType: result.recordingType as string | undefined,
    };
  } catch (error) {
    console.error("Failed to retrieve streaming data:", error);
    return null;
  }
};
