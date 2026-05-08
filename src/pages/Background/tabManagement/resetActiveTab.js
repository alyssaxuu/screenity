import { focusTab } from "./focusTab";
import { sendMessageTab } from "./sendMessageTab";
import { startRecording } from "../recording/startRecording";
import { getCurrentTab } from "./getCurrentTab";
import { traceStep } from "../../utils/startFlowTrace";
import { perfMark, perfSpan } from "../../utils/perfMarks";
import { handleRecordingError } from "../recording/recordingHelpers";

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
        startRecording("restartActiveTab-no-countdown");
      }
    } else {
      console.error("No active tab found.");
    }
  } catch (error) {
    console.error("Failed to restart active tab:", error);
  }
};

export const resetActiveTab = async (forceRestart = false, message = {}) => {
  perfMark("BG.resetActiveTab.enter", { forceRestart });
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
      let tab = null;
      try {
        tab = await chrome.tabs.get(activeTab);
      } catch (err) {
        // source tab closed between picker-confirm and ready-to-record
        console.warn(
          "[Screenity][resetActiveTab] source tab gone, surfacing recording-error",
          { activeTab, err: String(err).slice(0, 120) },
        );
        // chrome.runtime.sendMessage from SW doesn't fire SW's own listeners
        await handleRecordingError({
          error: "stream-error",
          why: "source tab closed during stream acquisition",
          errorCode: "REC_START_SOURCE_TAB_GONE",
        });
        return;
      }
      if (!tab) {
        console.error("Active tab not found.");
        return;
      }

      if (shouldFocusTab) {
        const endFocus = perfSpan("BG.resetActiveTab focus-back-to-tab");
        await chrome.windows.update(tab.windowId, { focused: true });
        await chrome.tabs.update(activeTab, {
          active: true,
          selected: true,
          highlighted: true,
        });
        await focusTab(activeTab);
        endFocus();
      }

      // currentTab fallback would hit the pinned recorder tab when surface==="browser"
      const targetTabId = activeTab || currentTab?.id;

      // awaited so the write lands before sendMessageTab triggers the content-side write
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
        perfMark("BG.resetActiveTab ready-to-record.sent", { targetTabId });
        sendMessageTab(targetTabId, { type: "ready-to-record" }).catch(() => {});

        const { countdown } = await chrome.storage.local.get(["countdown"]);

        if (!countdown) {
          startRecording("resetActiveTab-no-countdown", { storedCountdown: countdown });
        }
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
