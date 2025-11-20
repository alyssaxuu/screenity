export const focusTab = async (tabId: number | null): Promise<void> => {
  if (tabId === null) return;

  try {
    const tab = await new Promise<chrome.tabs.Tab | undefined>((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          resolve(undefined);
        } else {
          resolve(tab);
        }
      });
    });

    if (tab && tab.id && tab.windowId) {
      chrome.windows.update(tab.windowId, { focused: true }).then(() => {
        chrome.tabs.update(tab.id!, { active: true });
      });
    }
  } catch (error) {
    // Tab doesn't exist or can't be accessed
  }
};
