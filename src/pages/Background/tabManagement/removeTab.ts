export const removeTab = async (tabId: number | null): Promise<void> => {
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

    if (tab && tab.id) {
      chrome.tabs.remove(tab.id);
    }
  } catch (error) {
    // Tab doesn't exist or can't be accessed
  }
};
