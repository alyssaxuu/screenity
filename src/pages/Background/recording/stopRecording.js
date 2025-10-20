import { focusTab, sendMessageTab } from "../tabManagement/";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { sendMessageRecord } from "./sendMessageRecord";
import { sendChunks } from "./sendChunks";
import { waitForContentScript } from "../utils/waitForContentScript";

export const stopRecording = async () => {
  chrome.action.setIcon({ path: "assets/icon-34.png" });
  chrome.storage.local.set({ restarting: false });
  const { recordingStartTime, isSubscribed } = await chrome.storage.local.get([
    "recordingStartTime",
    "isSubscribed",
  ]);

  let duration = Date.now() - recordingStartTime;
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

  if (isSubscribed) {
    chrome.alarms.clear("recording-alarm");
    discardOffscreenDocuments();
  } else if (duration > maxDuration) {
    // Open fallback editor
    chrome.tabs.create({ url: "editorfallback.html", active: true }, (tab) => {
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
              sendMessageTab(tab.id, { type: "large-recording" });
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
    // Open normal editor
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
