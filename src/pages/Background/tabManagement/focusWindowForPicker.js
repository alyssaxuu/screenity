// Puts the tab's window in front of its document PiP window before a share
// prompt. `focused` is Chrome's active-window state, which the prompt reads.
export const focusWindowForPicker = async (
  windows,
  windowId,
  { checks = 6, delayMs = 50 } = {}
) => {
  if (typeof windowId !== "number") return { focused: false };
  try {
    await windows.update(windowId, { focused: true });
    for (let i = 0; i < checks; i += 1) {
      const win = await windows.get(windowId);
      if (win?.focused) return { focused: true };
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  } catch {}
  return { focused: false };
};
