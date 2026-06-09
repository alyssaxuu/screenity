export const setMicActiveTab = async (request) => {
  // The recorder (offscreen doc or in-tab iframe) owns the mic track for ALL
  // modes, so the mid-recording mic toggle must reach it regardless of mode.
  // Gating on `region` (only ever true for region recordings) silently dropped
  // the toggle for screen/tab/camera recordings, where setMic was never called.
  sendMessageRecord({
    type: "set-mic-active-tab",
    active: request.active,
    defaultAudioInput: request.defaultAudioInput,
  });
};
