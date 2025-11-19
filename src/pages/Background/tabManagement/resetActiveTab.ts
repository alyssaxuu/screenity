import { focusTab } from "./focusTab";
import { sendMessageTab } from "./sendMessageTab";
import {
  startAfterCountdown,
  startRecording,
} from "../recording/startRecording";
import { getCurrentTab } from "./getCurrentTab";

export const restartActiveTab = async (): Promise<any> => {
  try {
    const activeTab = await getCurrentTab();
    if (activeTab && activeTab.id) {
      sendMessageTab(activeTab.id, { type: "ready-to-record" });

      const { countdown } = await chrome.storage.local.get(["countdown"]);
      const delay = countdown ? 3500 : 500;

      setTimeout(() => {
        if (countdown) {
          startAfterCountdown();
        } else {
          startRecording();
        }
      }, delay);
    } else {
      console.error("No active tab found.");
    }
  } catch (error) {
    console.error("Failed to restart active tab:", error);
  }
};

export const resetActiveTab = async (forceRestart : boolean = false): Promise<any> => {
  const { activeTab } = await chrome.storage.local.get(["activeTab"]);
  const { surface } = await chrome.storage.local.get(["surface"]);

  if (forceRestart) {
    return restartActiveTab();
  }

  const [currentTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const shouldFocusTab =
    surface !== "browser" ||
    (activeTab && (await isRestrictedDomain(activeTab)));

  if (activeTab) {
    try {
      const tab = await chrome.tabs.get(activeTab);
      if (!tab) {
        console.error("Active tab not found.");
        return;
      }

      // Focus and update only if needed
      if (shouldFocusTab) {
        await chrome.windows.update(tab.windowId, { focused: true });
        await chrome.tabs.update(activeTab, {
          active: true,
          selected: true,
          highlighted: true,
        });
        await focusTab(activeTab);
      }

      // Decide which tab to send message to
      const targetTabId = shouldFocusTab ? activeTab : currentTab?.id;

      if (targetTabId) {
        sendMessageTab(targetTabId, { type: "ready-to-record" });

        const { countdown } = await chrome.storage.local.get(["countdown"]);
        const delay = countdown ? 3500 : 500;

        setTimeout(() => {
          if (countdown) {
            startAfterCountdown();
          } else {
            startRecording();
          }
        }, delay);
      } else {
        console.error("No valid tab to send message to.");
      }
    } catch (error) {
      console.error("Failed to get tab or send message:", error);
    }
  } else {
    console.error("No active tab ID stored.");
  }

  async function isRestrictedDomain(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const url = new URL(tab.url);
      return (
        url.hostname.includes("google.com") ||
        url.protocol === "chrome:" ||
        url.protocol === "chrome-extension:" ||
        url.protocol === "about:"
      );
    } catch (e) {
      return false;
    }
  }
};

export const resetActiveTabRestart = async (): Promise<any> => {
  await resetActiveTab(true);
};
