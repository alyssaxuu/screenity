import { focusTab } from "./focusTab";
import { sendMessageTab } from "./sendMessageTab";
import { startRecording } from "../recording/startRecording";
import { getCurrentTab } from "./getCurrentTab";
import { traceStep } from "../../utils/startFlowTrace";

export const restartActiveTab = async (message = {}) => {
  try {
    const { recordingUiTabId, activeTab: storedActiveTab } =
      await chrome.storage.local.get(["recordingUiTabId", "activeTab"]);
    const preferredTabId =
      message?.sourceTabId || recordingUiTabId || storedActiveTab || null;
    const currentTab = await getCurrentTab();
    const targetTabId = preferredTabId || currentTab?.id || null;
    if (targetTabId) {
      sendMessageTab(targetTabId, { type: "ready-to-record" });

      const { countdown } = await chrome.storage.local.get(["countdown"]);

      if (!countdown) {
        startRecording();
      }
      // With countdown, content shows the UI and sends "countdown-finished".
    } else {
      console.error("No active tab found.");
    }
  } catch (error) {
    console.error("Failed to restart active tab:", error);
  }
};

export const resetActiveTab = async (forceRestart = false, message = {}) => {
  const { activeTab } = await chrome.storage.local.get(["activeTab"]);
  const { surface } = await chrome.storage.local.get(["surface"]);

  if (forceRestart) {
    return restartActiveTab(message);
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

      // Always prefer the stored activeTab (the user's page, set before the
      // recorder tab is created). Falling back to currentTab can target the
      // pinned recorder tab when surface === "browser".
      const targetTabId = activeTab || currentTab?.id;

      // Persist routing decision to the start-flow trace. Awaited so the
      // write lands before sendMessageTab triggers the content-side write.
      await traceStep("readyToRecordSent", {
        routing: {
          targetTabId,
          activeTab,
          currentTabId: currentTab?.id,
          shouldFocusTab,
        },
        surface,
      });

      if (targetTabId) {
        sendMessageTab(targetTabId, { type: "ready-to-record" }).catch(() => {});

        const { countdown } = await chrome.storage.local.get(["countdown"]);

        if (!countdown) {
          // No countdown — start immediately.  The recorder's readiness gate
          // will wait for the stream to be live before actually recording.
          startRecording();
        }
        // With countdown: Content shows the countdown UI and sends
        // "countdown-finished" when done, which triggers startAfterCountdown().
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

export const resetActiveTabRestart = async (message = {}) => {
  await resetActiveTab(true, message);
};
