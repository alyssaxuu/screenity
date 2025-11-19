export const focusTab = async (tabId: any): Promise<any> => {
  if (tabId === null) return;

  try {
    const tab = await new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        resolve(tab);
      });
    });

    if (tab && tab.id) {
      chrome.windows.update(tab.windowId, { focused: true }).then(() => {
        chrome.tabs.update(tab.id, { active: true });
      });
    }
  } catch (error) {
    // Tab doesn't exist or can't be accessed
  }
};
