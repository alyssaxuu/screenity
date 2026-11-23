// Chrome shows a getDisplayMedia prompt in this page's document PiP window, and
// offers that window as "this tab", whenever the PiP is the focused window.
export const PICKER_FOCUS_TIMEOUT_MS = 1000;

// Any document PiP on this page counts: ours, or the site's own (Meet has one).
export const hasFloatingWindow = (ownWindow, win) => {
  if (ownWindow) return true;
  try {
    const pip = win?.documentPictureInPicture?.window;
    return Boolean(pip && !pip.closed);
  } catch {
    return false;
  }
};

// One cap covers the wait for an opening window too, so a stuck open cannot hang the start.
export const focusTabForPicker = async ({
  waitForOpening,
  hasWindow,
  focusTab,
  timeoutMs = PICKER_FOCUS_TIMEOUT_MS,
}) => {
  let timer;
  let timedOut = false;
  const run = async () => {
    // The camera window opens in the Record click; settle it or it takes focus later.
    try {
      await waitForOpening();
    } catch {}
    if (timedOut) return "unconfirmed";
    try {
      if (!hasWindow()) return "no-window";
      const result = await focusTab();
      return result?.focused ? "focused" : "unconfirmed";
    } catch {
      return "failed";
    }
  };
  try {
    return await Promise.race([
      run(),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve("unconfirmed");
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

// Region only. The outcome goes in the local start-flow trace (diagnostic zip);
// the server report has no field for it yet.
export const focusBeforeRegionPicker = async (state, { focus, trace }) => {
  if (state?.recordingType !== "region") return null;
  const outcome = await focus();
  try {
    trace(outcome);
  } catch {}
  return outcome;
};
