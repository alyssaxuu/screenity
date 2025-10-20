export const isPinned = async () => {
  try {
    const userSettings = await chrome.action.getUserSettings();
    return userSettings.isOnToolbar;
  } catch (error) {
    console.error("Failed to check if the extension is pinned:", error.message);
    return false;
  }
};

export const getPlatformInfo = async () => {
  try {
    return await chrome.runtime.getPlatformInfo();
  } catch (error) {
    console.error("Failed to retrieve platform info:", error.message);
    return null;
  }
};

export const resizeWindow = async (width, height) => {
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

export const checkAvailableMemory = async () => {
  try {
    const data = await navigator.storage.estimate();

    return { data };
  } catch (error) {
    console.error("Failed to estimate memory:", error);
    return { error: error.message };
  }
};
