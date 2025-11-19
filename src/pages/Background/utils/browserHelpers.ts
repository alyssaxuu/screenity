export const isPinned = async (): Promise<any> => {
  try {
    const userSettings = await chrome.action.getUserSettings();
    return userSettings.isOnToolbar;
  } catch (error) {
    console.error("Failed to check if the extension is pinned:", error.message);
    return false;
  }
};

export const getPlatformInfo = async (): Promise<any> => {
  try {
    return await chrome.runtime.getPlatformInfo();
  } catch (error) {
    console.error("Failed to retrieve platform info:", error.message);
    return null;
  }
};

export const resizeWindow = async (width, height: any): Promise<any> => {
  if (width === 0 || height === 0) {
    return;
  }

  chrome.windows.getCurrent((window) => {
    chrome.windows.update(window.id, {
      width: width,
      height: height,
    });
  });
};

export const checkAvailableMemory = async (): Promise<any> => {
  try {
    const data = await navigator.storage.estimate();

    return { data };
  } catch (error) {
    console.error("Failed to estimate memory:", error);
    return { error: error.message };
  }
};
