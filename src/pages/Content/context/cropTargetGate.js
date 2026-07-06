// Gate for the region crop-target re-send: only during an active start, never
// on an idle toggle (which once tripped a recording before Start was clicked).
export const shouldResendCropTarget = (state) => {
  if (!state) return false;
  if (state.recordingType !== "region") return false;
  if (!state.cropTarget) return false;
  return Boolean(
    state.pendingRecording || state.preparingRecording || state.recording
  );
};
