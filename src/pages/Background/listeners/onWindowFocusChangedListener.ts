import { handleTabActivation } from "./onTabActivatedListener";

interface TabActiveInfo {
  tabId: number;
  windowId?: number;
}

export const onWindowFocusChangedListener = async (windowId: number): Promise<void> => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  try {
    const tabs = await chrome.tabs.query({ active: true, windowId });
    if (tabs && tabs[0] && tabs[0].id) {
      handleTabActivation({ tabId: tabs[0].id, windowId });
    }
  } catch (error) {
    console.error("Failed to query active tab:", error);
  }
};
