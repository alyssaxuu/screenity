// Stop during the countdown is a cancel: nothing has been recorded yet, and a
// stop sent on to the recorder finalized an empty take into an error.
export const inCountdown = (state) =>
  Boolean(state) &&
  !state.recording &&
  Boolean(state.countdownActive || state.isCountdownVisible);

// A restart's countdown is left alone, as before: the background skips it too.
export const cancelCountdownForStop = async ({ getState, readRestarting }) => {
  if (!inCountdown(getState())) return false;
  if (await readRestarting()) return false;
  const state = getState();
  if (!inCountdown(state)) return false;
  state.cancelCountdown();
  return true;
};
