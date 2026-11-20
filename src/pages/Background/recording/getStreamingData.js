export const getStreamingData = async () => {
  try {
    const {
      micActive,
      defaultAudioInput,
      defaultAudioOutput,
      defaultVideoInput,
      systemAudio,
      recordingType,
      offscreen,
      tabCaptureTabId,
    } = await chrome.storage.local.get([
      "micActive",
      "defaultAudioInput",
      "defaultAudioOutput",
      "defaultVideoInput",
      "systemAudio",
      "recordingType",
      "offscreen",
      "tabCaptureTabId",
    ]);

    return {
      micActive,
      defaultAudioInput,
      defaultAudioOutput,
      defaultVideoInput,
      systemAudio,
      recordingType,
      // Only the offscreen route stores it; a tab-hosted recorder gets its
      // tab id from the `loaded` retry loop, so a stale value must not leak.
      tabCaptureTabId: offscreen ? (tabCaptureTabId ?? null) : null,
    };
  } catch (error) {
    console.error("Failed to retrieve streaming data:", error);
    return null;
  }
};
