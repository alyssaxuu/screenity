import { handleTabActivation } from "./onTabActivatedListener.js";

const handleWindowFocusChanged = async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  try {
    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs && tabs[0]) {
      handleTabActivation({ tabId: tabs[0].id });
    }
  } catch (error) {
    console.error("Failed to query active tab:", error);
  }
};

export const onWindowFocusChangedListener = () => {
  if (!chrome.windows.onFocusChanged.hasListener(handleWindowFocusChanged)) {
    chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);
  }
};
