/**
 * Checks if the extension is pinned to the toolbar
 * @returns Promise that resolves to true if pinned
 */
export const isPinned = async (): Promise<boolean> => {
  try {
    const userSettings = await chrome.action.getUserSettings();
    return userSettings.isOnToolbar;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to check if the extension is pinned:", err.message);
    return false;
  }
};

/**
 * Gets platform information
 * @returns Promise that resolves to platform info or null
 */
export const getPlatformInfo = async (): Promise<chrome.runtime.PlatformInfo | null> => {
  try {
    return await chrome.runtime.getPlatformInfo();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to retrieve platform info:", err.message);
    return null;
  }
};

/**
 * Resizes the current window
 * @param width - New width in pixels
 * @param height - New height in pixels
 */
export const resizeWindow = async (width: number, height: number): Promise<void> => {
  if (width === 0 || height === 0) {
    return;
  }

  chrome.windows.getCurrent((window) => {
    if (window?.id) {
      chrome.windows.update(window.id, {
        width: width,
        height: height,
      });
    }
  });
};

interface StorageEstimate {
  quota?: number;
  usage?: number;
  usageDetails?: {
    indexedDB?: number;
    caches?: number;
    serviceWorkerRegistrations?: number;
  };
}

interface MemoryCheckResult {
  data?: StorageEstimate;
  error?: string;
}

/**
 * Checks available storage/memory
 * @returns Promise that resolves to storage estimate or error
 */
export const checkAvailableMemory = async (): Promise<MemoryCheckResult> => {
  try {
    const data = await navigator.storage.estimate();
    return { data };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to estimate memory:", err);
    return { error: err.message };
  }
};

