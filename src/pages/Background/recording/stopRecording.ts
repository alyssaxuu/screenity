import { focusTab, sendMessageTab } from "../tabManagement/";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { sendMessageRecord } from "./sendMessageRecord";
import { sendChunks } from "./sendChunks";
import { waitForContentScript } from "../utils/waitForContentScript";
import { supportsWebCodecs } from "../utils/featureDetection";

export const stopRecording = async (): Promise<void> => {
  chrome.action.setIcon({ path: "assets/icon-34.png" });
  chrome.storage.local.set({ restarting: false });
  const result = await chrome.storage.local.get([
    "recordingStartTime",
    "isSubscribed",
  ]);
  const recordingStartTime = result.recordingStartTime as number | undefined;
  const isSubscribed = result.isSubscribed as boolean | undefined;

  let duration = Date.now() - (recordingStartTime || 0);
  const maxDuration = 7 * 60 * 1000;

  if (recordingStartTime === 0) {
    duration = 0;
  }

  chrome.storage.local.set({
    recording: false,
    recordingDuration: duration,
    tabRecordedID: null,
  });

  chrome.storage.local.set({ recordingStartTime: 0 });

  // Check if browser supports WebCodecs for Mediabunny
  const hasWebCodecs = await supportsWebCodecs();

  if (isSubscribed) {
    chrome.alarms.clear("recording-alarm");
    discardOffscreenDocuments();
  } else if (hasWebCodecs) {
    // Use Mediabunny (editorwebcodecs.html) when WebCodecs is supported
    chrome.tabs.create({ url: "editorwebcodecs.html", active: true }, (tab) => {
      if (!tab.id) return;
      chrome.tabs.onUpdated.addListener(function _(
        tabId: number,
        changeInfo: { status?: string } | undefined,
        updatedTab: chrome.tabs.Tab
      ) {
        if (tabId === tab.id && changeInfo?.status === "complete" && tab.id) {
          chrome.tabs.onUpdated.removeListener(_);
          chrome.storage.local.set({ sandboxTab: tab.id });
          waitForContentScript(tab.id)
            .then(() => {
              // Use fallback-recording for WebCodecs flow
              sendMessageTab(tab.id!, { type: "fallback-recording" });
            })
            .catch((err) => {
              const error = err instanceof Error ? err : new Error(String(err));
              console.error(
                "❌ Failed to wait for content script:",
                error.message
              );
            });
        }
      });
    });

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } else if (duration > maxDuration) {
    // Fallback for large recordings without WebCodecs - use viewer mode

    chrome.tabs.create({ url: "editorviewer.html", active: true }, (tab) => {
      if (!tab.id) return;
      chrome.tabs.onUpdated.addListener(function _(
        tabId: number,
        changeInfo: { status?: string } | undefined,
        updatedTab: chrome.tabs.Tab
      ) {
        if (tabId === tab.id && changeInfo?.status === "complete" && tab.id) {
          chrome.tabs.onUpdated.removeListener(_);
          chrome.storage.local.set({ sandboxTab: tab.id });
          waitForContentScript(tab.id)
            .then(() => {
              sendMessageTab(tab.id!, { type: "viewer-recording" });
            })
            .catch((err) => {
              const error = err instanceof Error ? err : new Error(String(err));
              console.error(
                "❌ Failed to wait for content script:",
                error.message
              );
            });
        }
      });
    });

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } else {
    // Use FFmpeg (editor.html) for browsers without WebCodecs
    chrome.tabs.create({ url: "editor.html", active: true }, (tab) => {
      if (!tab.id) return;
      chrome.tabs.onUpdated.addListener(function _(
        tabId: number,
        changeInfo: { status?: string } | undefined,
        updatedTab: chrome.tabs.Tab
      ) {
        if (tabId === tab.id && changeInfo?.status === "complete" && tab.id) {
          chrome.tabs.onUpdated.removeListener(_);
          chrome.storage.local.set({ sandboxTab: tab.id });
          waitForContentScript(tab.id)
            .then(() => {
              sendChunks();
            })
            .catch((err) => {
              const error = err instanceof Error ? err : new Error(String(err));
              console.error(
                "❌ Failed to wait for content script:",
                error.message
              );
            });
        }
      });
    });

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  }

  const wasResult = await chrome.storage.local.get(["wasRegion"]);
  const wasRegion = wasResult.wasRegion as boolean | undefined;
  if (wasRegion) {
    chrome.storage.local.set({ wasRegion: false, region: true });
  }

  chrome.alarms.clear("recording-alarm");
  discardOffscreenDocuments();
};

import type { ExtensionMessage } from "../../../types/messaging";

export const handleStopRecordingTab = async (request: ExtensionMessage): Promise<void> => {
  chrome.action.setIcon({ path: "assets/icon-34.png" });
  if (request.memoryError) {
    chrome.storage.local.set({
      recording: false,
      restarting: false,
      tabRecordedID: null,
      memoryError: true,
    });
  }

  sendMessageRecord({ type: "stop-recording-tab" });
};

export const handleStopRecordingTabBackup = async (request: ExtensionMessage): Promise<void> => {
  chrome.storage.local.set({
    recording: false,
    restarting: false,
    tabRecordedID: null,
    memoryError: true,
  });
  sendMessageRecord({ type: "stop-recording-tab" });

  const activeResult = await chrome.storage.local.get(["activeTab"]);
  const activeTab = activeResult.activeTab as number | undefined;

  if (activeTab) {
    sendMessageTab(activeTab, { type: "stop-pending" });
    focusTab(activeTab);
  }
};
