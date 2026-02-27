import { sendMessageTab, getCurrentTab } from "../tabManagement";
import { sendMessageRecord } from "../recording/sendMessageRecord.js";
import { stopRecording } from "../recording/stopRecording.js";
import { loginWithWebsite } from "../auth/loginWithWebsite.js";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

// Utility to handle tab messaging logic
const handleTabMessaging = async (tab) => {
  const { activeTab, recordingUiTabId } = await chrome.storage.local.get([
    "activeTab",
    "recordingUiTabId",
  ]);
  const preferredTabId = recordingUiTabId || activeTab;

  try {
    const targetTab = preferredTabId
      ? await chrome.tabs.get(preferredTabId)
      : null;

    if (targetTab) {
      sendMessageTab(preferredTabId, { type: "stop-recording-tab" });
    } else {
      sendMessageTab(tab.id, { type: "stop-recording-tab" });
      chrome.storage.local.set({ activeTab: tab.id });
    }
  } catch (error) {
    console.error("Error in handleTabMessaging:", error);
  }
};

// Utility to open Playground or inject popup
const openPlaygroundOrPopup = async (tab) => {
  const editorUrlPattern =
    /https?:\/\/(app\.screenity\.io|localhost:3000)\/editor\/([^\/]+)(\/edit)?\/?/;

  if (tab.url && editorUrlPattern.test(tab.url)) {
    await chrome.storage.local.set({ editorTab: tab.id });

    if (CLOUD_FEATURES_ENABLED) {
      const result = await loginWithWebsite();

      if (result?.authenticated) {
        const match = tab.url.match(editorUrlPattern);
        const projectIdFromUrl = match[2];

        await chrome.storage.local.set({
          projectId: projectIdFromUrl,
          recordingToScene: true,
          instantMode: false,
        });

        sendMessageTab(tab.id, {
          type: "get-project-info",
        });
      } else {
        await chrome.storage.local.set({
          projectId: null,
          recordingToScene: false,
          activeSceneId: null,
        });
      }
    } else {
      await chrome.storage.local.set({
        projectId: null,
        recordingToScene: false,
        activeSceneId: null,
      });
    }
  } else {
    await chrome.storage.local.set({
      projectId: null,
      recordingToScene: false,
      activeSceneId: null, // reset scene too if needed
    });
  }

  const forbiddenURLs = [
    "chrome://",
    "chrome-extension://",
    "chrome.google.com/webstore",
    "chromewebstore.google.com",
    "stackoverflow.com/",
  ];

  const isForbidden = forbiddenURLs.some((url) => tab.url.startsWith(url));
  const isPlaygroundOrSetup =
    tab.url.includes("/playground.html") || tab.url.includes("/setup.html");

  if ((!isForbidden || isPlaygroundOrSetup) && navigator.onLine) {
    sendMessageTab(tab.id, { type: "toggle-popup" });
    chrome.storage.local.set({ activeTab: tab.id });
  } else {
    const newTab = await chrome.tabs.create({
      url: "playground.html",
      active: true,
    });
    chrome.storage.local.set({ activeTab: newTab.id });

    const onUpdated = (tabId, changeInfo, updatedTab) => {
      if (updatedTab.id === newTab.id && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        setTimeout(() => {
          sendMessageTab(newTab.id, { type: "toggle-popup" });
        }, 500);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  }
};

// Main action button listener
export const onActionButtonClickedListener = () => {
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      const { recording, pendingRecording, restarting, recorderSession } =
        await chrome.storage.local.get([
          "recording",
          "pendingRecording",
          "restarting",
          "recorderSession",
        ]);
      const sessionRecording = recorderSession?.status === "recording";
      const isRecordingActive = Boolean(
        recording || pendingRecording || restarting || sessionRecording,
      );

      if (isRecordingActive) {
        await handleTabMessaging(tab);
      } else {
        // Reset storage keys before opening the popup
        await chrome.storage.local.set({
          recordingToScene: false,
          projectId: null,
          activeSceneId: null,
        });
        await openPlaygroundOrPopup(tab);
      }

      const { firstTime } = await chrome.storage.local.get(["firstTime"]);
      if (firstTime && tab.url.includes(chrome.runtime.getURL("setup.html"))) {
        chrome.storage.local.set({ firstTime: false });
        const activeTab = await getCurrentTab();
        sendMessageTab(activeTab.id, { type: "setup-complete" });
      }
    } catch (error) {
      console.error("Error handling action click:", error);
    }
  });
};
