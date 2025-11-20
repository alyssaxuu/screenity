export const isPinned = async (): Promise<boolean> => {
  try {
    const userSettings = await chrome.action.getUserSettings();
    return userSettings.isOnToolbar || false;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to check if the extension is pinned:", err.message);
    return false;
  }
};

export const getPlatformInfo =
  async (): Promise<chrome.runtime.PlatformInfo | null> => {
    try {
      return await chrome.runtime.getPlatformInfo();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Failed to retrieve platform info:", err.message);
      return null;
    }
  };

export const resizeWindow = async (
  width: number,
  height: number
): Promise<void> => {
  if (width === 0 || height === 0) {
    return;
  }

  chrome.windows.getCurrent((window) => {
    if (window && window.id) {
      chrome.windows.update(window.id, {
        width: width,
        height: height,
      });
    }
  });
};

interface MemoryEstimate {
  data?: StorageEstimate;
  error?: string;
}

export const checkAvailableMemory = async (): Promise<MemoryEstimate> => {
  try {
    const data = await navigator.storage.estimate();
    return { data };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to estimate memory:", err);
    return { error: err.message };
  }
};
