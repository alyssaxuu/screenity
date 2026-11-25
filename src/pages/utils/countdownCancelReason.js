// A restart's countdown cancel gets its own reason: the background deletes the
// project after a plain countdown cancel, and a restart's project is not a
// fresh shell. Content clears `restarting` before the dismiss, so the
// background cannot tell from storage.
export const countdownCancelReason = ({ duringRestart }) =>
  duringRestart ? "restart-countdown-cancelled" : "countdown-cancelled";
