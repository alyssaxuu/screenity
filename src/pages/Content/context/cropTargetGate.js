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

// The focus wait can outlast the start (cancelled, stopped), so the gate is read
// again from live state before the crop target goes out.
export const resendCropTargetAfterFocus = async ({ getState, focus }) => {
  const before = getState();
  if (!shouldResendCropTarget(before)) return false;
  if (!before.regionCaptureRef?.contentWindow) return false;
  await focus(before);
  const state = getState();
  if (!shouldResendCropTarget(state)) return false;
  const regionWin = state.regionCaptureRef?.contentWindow;
  if (!regionWin) return false;
  regionWin.postMessage(
    {
      type: "crop-target",
      target: state.cropTarget,
      width: state.regionWidth,
      height: state.regionHeight,
    },
    "*"
  );
  return true;
};
