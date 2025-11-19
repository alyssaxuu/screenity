import { handleTabActivation } from "./onTabActivatedListener.js";

export const onWindowFocusChangedListener = async (windowId: any): Promise<any> => {
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
