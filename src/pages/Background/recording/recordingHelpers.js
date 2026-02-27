import {
  sendMessageTab,
  focusTab,
  removeTab,
  getCurrentTab,
} from "../tabManagement";
import { sendMessageRecord } from "./sendMessageRecord";
import { stopRecording } from "./stopRecording";
import { addAlarmListener } from "../alarms/addAlarmListener";
import { getStreamingData } from "./getStreamingData";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
export const checkCapturePermissions = async ({ isLoggedIn, isSubscribed }) => {
  const permissions = ["desktopCapture", "alarms", "offscreen"];

  // Add clipboardWrite and notifications only for subscribed users
  if (isLoggedIn && isSubscribed) {
    permissions.push("clipboardWrite");
  }

  // Check if required APIs are available in this browser context
  if (
    chrome.desktopCapture &&
    chrome.alarms &&
    chrome.offscreen &&
    (!permissions.includes("clipboardWrite") || chrome.clipboard)
  ) {
    return { status: "ok" };
  }

  const granted = await new Promise((resolve) => {
    chrome.permissions.request({ permissions }, resolve);
  });

  if (granted) {
    addAlarmListener();
    return { status: "ok" };
  } else {
    return { status: "error" };
  }
};

export const handlePip = async (started = false) => {
  const { activeTab } = await chrome.storage.local.get(["activeTab"]);
  if (started) {
    sendMessageTab(activeTab, { type: "pip-started" });
  } else {
    sendMessageTab(activeTab, { type: "pip-ended" });
  }
};

export const handleOnGetPermissions = async (request) => {
  // Send a message to (actual) active tab
  const activeTab = await getCurrentTab();
  if (activeTab) {
    sendMessageTab(activeTab.id, {
      type: "on-get-permissions",
      data: request,
    });
  }
};

export const handleRecordingComplete = async () => {
  const { recordingTab } = await chrome.storage.local.get(["recordingTab"]);

  if (recordingTab) {
    chrome.tabs.get(recordingTab, (tab) => {
      if (tab) {
        // Check if tab url contains chrome-extension and recorder.html
        if (
          tab.url.includes("chrome-extension") &&
          tab.url.includes("recorder.html")
        ) {
          // FLAG: For testing purposes -> comment to debug
          removeTab(recordingTab);
        }
      }
    });
  }
};

export const handleRecordingError = async (request) => {
  if (globalThis.SCREENITY_VERBOSE_LOGS) {
    console.log("handleRecordingError called with request:", request);
  }
  try {
    await chrome.storage.local.set({
      lastRecordingError: {
        ts: Date.now(),
        error: request?.error || null,
        why: request?.why || null,
      },
    });
  } catch {}
  const { activeTab, recordingUiTabId, tabRecordedID } =
    await chrome.storage.local.get([
      "activeTab",
      "recordingUiTabId",
      "tabRecordedID",
    ]);

  await chrome.storage.local.set({
    pendingRecording: false,
  });

  // For stream-ended, we just notify the user but DON'T stop the recording
  // The user can decide whether to continue or stop
  if (request.error === "stream-ended") {
    sendMessageTab(activeTab, {
      type: "stream-ended-warning",
      message: request.why || "Screen sharing stopped unexpectedly.",
    }).catch(() => {});
    return; // Don't continue with the normal error handling
  }

  await chrome.storage.local.set({
    recording: false,
    recordingUiTabId: null,
    tabRecordedID: null,
  });

  chrome.runtime
    .sendMessage({
      type: "clear-recording-session-safe",
      reason: "recording-error-terminal",
    })
    .catch(() => {});

  sendMessageRecord({ type: "recording-error" }).then(() => {
    const candidateTabs = [activeTab, recordingUiTabId, tabRecordedID].filter(
      (id, idx, arr) => Number.isInteger(id) && arr.indexOf(id) === idx,
    );
    candidateTabs.forEach((id) => {
      sendMessageTab(id, { type: "stop-pending" }).catch(() => {});
    });
    focusTab(activeTab);
    if (request.error === "stream-error") {
      sendMessageTab(activeTab, { type: "stream-error" });
    } else if (request.error === "backup-error") {
      sendMessageTab(activeTab, { type: "backup-error" });
    }
  });

  const { recordingTab } = await chrome.storage.local.get(["recordingTab"]);
  const { region } = await chrome.storage.local.get(["region"]);
  if (recordingTab && !region) {
    // FLAG: For testing purposes -> comment to debug
    removeTab(recordingTab);
  }
  chrome.storage.local.set({ recordingTab: null });
  discardOffscreenDocuments();
};

export const handleGetStreamingData = async () => {
  const data = await getStreamingData();
  sendMessageRecord({ type: "streaming-data", data: JSON.stringify(data) });
};

export const videoReady = async () => {
  const { backupTab } = await chrome.storage.local.get(["backupTab"]);
  if (backupTab) {
    sendMessageTab(backupTab, { type: "close-writable" });
  }
  chrome.runtime
    .sendMessage({
      type: "clear-recording-session-safe",
      reason: "video-ready-terminal",
    })
    .catch(() => {});
  stopRecording();
};

export const writeFile = async (request) => {
  const { backupTab } = await chrome.storage.local.get(["backupTab"]);

  if (backupTab) {
    sendMessageTab(
      backupTab,
      {
        type: "write-file",
        index: request.index,
      },
      null,
      () => {
        sendMessageRecord({ type: "stop-recording-tab" });
      },
    );
  } else {
    sendMessageRecord({ type: "stop-recording-tab" });
  }
};
