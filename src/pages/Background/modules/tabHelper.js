const sendMessageTab = async (
  tabId,
  message,
  responseCallback = false,
  noTab = false
) => {
  if (tabId === null || message === null) return;
  try {
    const tab = await new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        resolve(tab);
      });
    });

    // Check if tab is an internal chrome:// page
    if (
      (tab && tab.url && tab.url.startsWith("chrome://")) ||
      tab.url.startsWith("chromewebstore.google.com") ||
      tab.url.startsWith("chrome.google.com/webstore") ||
      tab.url === "" ||
      tab.url === "about:blank"
    ) {
      return;
    } else if (!tab || !tab.url) {
      return;
    }

    if (tab && tab.id) {
      if (responseCallback && typeof responseCallback === "function") {
        chrome.tabs.sendMessage(tab.id, message, responseCallback);
      } else {
        chrome.tabs.sendMessage(tab.id, message);
      }
    } else if (noTab && typeof noTab === "function") {
      noTab();
    }
  } catch (error) {
    // Tab doesn't exist or can't be accessed
  }
};

const focusTab = async (tabId) => {
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

const removeTab = async (tabId) => {
  if (tabId === null) return;

  try {
    const tab = await new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        resolve(tab);
      });
    });

    if (tab && tab.id) {
      chrome.tabs.remove(tab.id);
    }
  } catch (error) {
    // Tab doesn't exist or can't be accessed
  }
};

// Get current tab (requires activeTab permission)
const getCurrentTab = async () => {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
};

const createTab = async (url, translate = false, active = false) => {
  if (!url) return;

  if (translate) {
    const locale = chrome.i18n.getMessage("@@ui_locale");
    if (!locale.includes("en")) {
      url =
        "http://translate.google.com/translate?js=n&sl=auto&tl=" +
        locale +
        "&u=" +
        url;
    }
  }

  chrome.tabs.create({
    url: url,
    active: active,
  });
};

export { sendMessageTab, focusTab, removeTab, getCurrentTab, createTab };
