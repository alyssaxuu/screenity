import { focusTab, sendMessageTab } from "../tabManagement/";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { sendMessageRecord } from "./sendMessageRecord";
import { sendChunks } from "./sendChunks";
import { waitForContentScript } from "../utils/waitForContentScript";
import { supportsWebCodecs } from "../utils/featureDetection";

export const stopRecording = async () => {
  chrome.action.setIcon({ path: "assets/icon-34.png" });
  chrome.storage.local.set({ restarting: false });
  const {
    recordingStartTime,
    isSubscribed,
    paused,
    pausedAt,
    totalPausedMs,
  } = await chrome.storage.local.get([
    "recordingStartTime",
    "isSubscribed",
    "paused",
    "pausedAt",
    "totalPausedMs",
  ]);

  const startTime = Number(recordingStartTime);
  const now = Date.now();
  const basePaused = Number(totalPausedMs) || 0;
  const pausedAtMs = Number(pausedAt);
  const extraPaused =
    paused && Number.isFinite(pausedAtMs) && pausedAtMs > 0
      ? Math.max(0, now - pausedAtMs)
      : 0;

  let duration =
    Number.isFinite(startTime) && startTime > 0
      ? Math.max(0, now - startTime - basePaused - extraPaused)
      : 0;
  const maxDuration = 7 * 60 * 1000;

  chrome.storage.local.set({
    recording: false,
    recordingDuration: duration,
    tabRecordedID: null,
  });

  chrome.storage.local.set({ recordingStartTime: 0 });

  // Check if browser supports WebCodecs for Mediabunny
  //const hasWebCodecs = supportsWebCodecs();
  // FLAG: Force old FFMPEG for now
  const hasWebCodecs = false;

  if (isSubscribed) {
    chrome.alarms.clear("recording-alarm");
    discardOffscreenDocuments();
    chrome.storage.local.remove(["recordingMeta"]);
  } else if (hasWebCodecs) {
    // Use Mediabunny (editorwebcodecs.html) when WebCodecs is supported
    chrome.tabs.create({ url: "editorwebcodecs.html", active: true }, (tab) => {
      chrome.tabs.onUpdated.addListener(function _(
        tabId,
        changeInfo,
        updatedTab
      ) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(_);
          chrome.storage.local.set({ sandboxTab: tab.id });
          waitForContentScript(tab.id)
            .then(() => {
              // Use fallback-recording for WebCodecs flow
              sendMessageTab(tab.id, { type: "fallback-recording" });
            })
            .catch((err) => {
              console.error(
                "❌ Failed to wait for content script:",
                err.message
              );
            });
        }
      });
    });

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } else if (duration > maxDuration) {
    // Fallback for large recordings without WebCodecs - use viewer mode

    chrome.tabs.create({ url: "editorviewer.html", active: true }, (tab) => {
      chrome.tabs.onUpdated.addListener(function _(
        tabId,
        changeInfo,
        updatedTab
      ) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(_);
          chrome.storage.local.set({ sandboxTab: tab.id });
          waitForContentScript(tab.id)
            .then(() => {
              sendMessageTab(tab.id, { type: "viewer-recording" });
            })
            .catch((err) => {
              console.error(
                "❌ Failed to wait for content script:",
                err.message
              );
            });
        }
      });
    });

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } else {
    // Use FFmpeg (editor.html) for browsers without WebCodecs
    chrome.tabs.create({ url: "editor.html", active: true }, (tab) => {
      chrome.tabs.onUpdated.addListener(function _(
        tabId,
        changeInfo,
        updatedTab
      ) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(_);
          chrome.storage.local.set({ sandboxTab: tab.id });
          waitForContentScript(tab.id)
            .then(() => {
              sendChunks();
            })
            .catch((err) => {
              console.error(
                "❌ Failed to wait for content script:",
                err.message
              );
            });
        }
      });
    });

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  }

  const { wasRegion } = await chrome.storage.local.get(["wasRegion"]);
  if (wasRegion) {
    chrome.storage.local.set({ wasRegion: false, region: true });
  }

  chrome.alarms.clear("recording-alarm");
  discardOffscreenDocuments();
};

export const handleStopRecordingTab = async (request) => {
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

export const handleStopRecordingTabBackup = async (request) => {
  chrome.storage.local.set({
    recording: false,
    restarting: false,
    tabRecordedID: null,
    memoryError: true,
  });
  sendMessageRecord({ type: "stop-recording-tab" });

  const { activeTab } = await chrome.storage.local.get(["activeTab"]);

  sendMessageTab(activeTab, { type: "stop-pending" });
  focusTab(activeTab);
};
