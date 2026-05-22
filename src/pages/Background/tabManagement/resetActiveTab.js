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
  // One storage IPC + the active-tab query in parallel. Two sequential
  // gets here were costing ~60-80ms; the read of activeTab/surface and
  // the active-tab query are independent so they should overlap.
  const [{ activeTab, surface }, [currentTab]] = await Promise.all([
    chrome.storage.local.get(["activeTab", "surface"]),
    chrome.tabs.query({ active: true, currentWindow: true }),
  ]);

  if (forceRestart) {
    return restartActiveTab(message);
  }

  if (activeTab) {
    try {
      let tab = null;
      try {
        // Single chrome.tabs.get (was 2 via isRestrictedDomain).
        // Saves ~30-60ms on the start path.
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

      // Decide focus from the already-fetched tab; no second
      // chrome.tabs.get inside isRestrictedDomain.
      let restricted = false;
      try {
        const url = new URL(tab.url || "");
        restricted =
          url.hostname.includes("google.com") ||
          url.protocol === "chrome:" ||
          url.protocol === "chrome-extension:" ||
          url.protocol === "about:";
      } catch {}
      const shouldFocusTab = surface !== "browser" || restricted;

      if (shouldFocusTab) {
        const endFocus = perfSpan("BG.resetActiveTab focus-back-to-tab");
        // Three focus ops in parallel. Chrome resolves them in the same
        // tick anyway and Promise.all halves the wall-clock cost.
        await Promise.all([
          chrome.windows.update(tab.windowId, { focused: true }),
          chrome.tabs.update(activeTab, {
            active: true,
            selected: true,
            highlighted: true,
          }),
          focusTab(activeTab),
        ]);
        endFocus();
      }

      // currentTab fallback would hit the pinned recorder tab when surface==="browser"
      const targetTabId = activeTab || currentTab?.id;

      // traceStep is a storage write for the diagnostic startflow trace -
      // not load-bearing for the message send below, so fire-and-forget.
      traceStep("readyToRecordSent", {
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
