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
interface CheckCapturePermissionsParams {
  isLoggedIn: boolean;
  isSubscribed: boolean;
}

export const checkCapturePermissions = async ({ 
  isLoggedIn, 
  isSubscribed 
}: CheckCapturePermissionsParams): Promise<{ status: string }> => {
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

export const handlePip = async (started: boolean = false): Promise<void> => {
  const result = await chrome.storage.local.get(["activeTab"]);
  const activeTab = result.activeTab as number | undefined;
  
  if (!activeTab) return;
  if (started) {
    sendMessageTab(activeTab, { type: "pip-started" });
  } else {
    sendMessageTab(activeTab, { type: "pip-ended" });
  }
};

import type { ExtensionMessage } from "../../../types/messaging";

export const handleOnGetPermissions = async (request: ExtensionMessage): Promise<void> => {
  // Send a message to (actual) active tab
  const activeTab = await getCurrentTab();
  if (activeTab) {
    sendMessageTab(activeTab.id, {
      type: "on-get-permissions",
      data: request,
    });
  }
};

export const handleRecordingComplete = async (): Promise<void> => {
  const result = await chrome.storage.local.get(["recordingTab"]);
  const recordingTab = result.recordingTab as number | undefined;

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

export const handleRecordingError = async (request: ExtensionMessage): Promise<void> => {
  const activeResult = await chrome.storage.local.get(["activeTab"]);
  const activeTab = activeResult.activeTab as number | undefined;

  if (!activeTab) return;

  sendMessageRecord({ type: "recording-error" }).then(() => {
    sendMessageTab(activeTab, { type: "stop-pending" });
    focusTab(activeTab);
    const error = (request as any).error;
    if (error === "stream-error") {
      sendMessageTab(activeTab, { type: "stream-error" });
    } else if (error === "backup-error") {
      sendMessageTab(activeTab, { type: "backup-error" });
    }
  });

  const recordingResult = await chrome.storage.local.get(["recordingTab"]);
  const regionResult = await chrome.storage.local.get(["region"]);
  const recordingTab = recordingResult.recordingTab as number | undefined;
  const region = regionResult.region as boolean | undefined;
  if (recordingTab && !region) {
    // FLAG: For testing purposes -> comment to debug
    removeTab(recordingTab);
  }
  chrome.storage.local.set({ recordingTab: null });
  discardOffscreenDocuments();
};

export const handleGetStreamingData = async (): Promise<void> => {
  const data = await getStreamingData();
  sendMessageRecord({ type: "streaming-data", data: JSON.stringify(data) });
};

export const videoReady = async (): Promise<void> => {
  const result = await chrome.storage.local.get(["backupTab"]);
  const backupTab = result.backupTab as number | undefined;
  if (backupTab) {
    sendMessageTab(backupTab, { type: "close-writable" });
  }
  stopRecording();
};

export const writeFile = async (request: ExtensionMessage): Promise<void> => {
  const result = await chrome.storage.local.get(["backupTab"]);
  const backupTab = result.backupTab as number | undefined;

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
      }
    );
  } else {
    sendMessageRecord({ type: "stop-recording-tab" });
  }
};
