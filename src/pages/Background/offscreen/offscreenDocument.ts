import { getCurrentTab } from "../tabManagement";
import { sendMessageRecord } from "../recording/sendMessageRecord.js";
import { closeOffscreenDocument } from "./closeOffscreenDocument.js";
import { loginWithWebsite } from "../auth/loginWithWebsite.js";

import type { ExtensionMessage } from "../../../types/messaging";

const openRecorderTab = async (
  activeTab: chrome.tabs.Tab | undefined,
  backup: boolean | undefined,
  isRegion: boolean | undefined,
  camera: boolean = false,
  request: ExtensionMessage
): Promise<void> => {
  let switchTab = true;

  // Check subscription status
  const { authenticated, subscribed } = await loginWithWebsite();
  const recorderUrl =
    authenticated && subscribed
      ? chrome.runtime.getURL("cloudrecorder.html")
      : chrome.runtime.getURL("recorder.html");

  if (!isRegion) {
    if (camera) {
      switchTab = false;
    }
  } else {
    switchTab = activeTab?.url?.includes(
      chrome.runtime.getURL("playground.html")
    ) || false;
  }

  chrome.tabs
    .create({
      url: recorderUrl,
      pinned: true,
      index: 0,
      // FLAG: Check this is ok?
      active: switchTab,
    })
    .then((tab) => {
      chrome.storage.local.set({
        recordingTab: tab.id,
        offscreen: false,
        region: false,
        wasRegion: true,
        clickEvents: [],
        ...(isRegion ? { tabRecordedID: activeTab.id } : {}),
      });

      chrome.tabs.onUpdated.addListener(function _(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(_);
          sendMessageRecord({
            type: "loaded",
            request: request,
            backup: backup,
            ...(isRegion
              ? {
                  isTab: true,
                  tabID: activeTab.id,
                }
              : {}),
          });
        }
      });
    });
};

import type { ExtensionMessage } from "../../../types/messaging";

export const offscreenDocument = async (
  request: ExtensionMessage,
  tabId: number | null = null
): Promise<any> => {
  const { backup } = await chrome.storage.local.get(["backup"]);
  let activeTab = await getCurrentTab();

  if (tabId !== null) {
    activeTab = await chrome.tabs.get(tabId);
  }

  if (!activeTab || !activeTab.id) {
    return;
  }

  chrome.storage.local.set({
    activeTab: activeTab.id,
    tabRecordedID: null,
    memoryError: false,
  });

  if (activeTab.url && activeTab.url.includes(chrome.runtime.getURL("playground.html"))) {
    chrome.storage.local.set({ tabPreferred: true });
  } else {
    chrome.storage.local.set({ tabPreferred: false });
  }

  await closeOffscreenDocument();

  if (request.region) {
    if (tabId !== null) chrome.tabs.update(tabId, { active: true });

    chrome.storage.local.set({
      recordingTab: activeTab.id,
      offscreen: false,
      region: true,
    });

    if (request.customRegion) {
      sendMessageRecord({
        type: "loaded",
        request: request,
        backup: backup,
        region: true,
      });
    } else {
      await openRecorderTab(activeTab, backup, true, false, request);
    }
  } else {
    if (!request.offscreenRecording || request.camera) {
      // Skip offscreen recording if conditions aren't met
      await openRecorderTab(activeTab, backup, false, request.camera, request);
      return;
    }

    try {
      if (tabId !== null) chrome.tabs.update(tabId, { active: true });

      const { qualityValue, fpsValue } = await chrome.storage.local.get([
        "qualityValue",
        "fpsValue",
      ]);

      await closeOffscreenDocument();

      await chrome.offscreen.createDocument({
        url: "recorderoffscreen.html",
        reasons: ["USER_MEDIA", "AUDIO_PLAYBACK", "DISPLAY_MEDIA"],
        justification: "Recording from getDisplayMedia API",
      });

      chrome.storage.local.set({
        recordingTab: null,
        offscreen: true,
        region: false,
        wasRegion: false,
      });

      sendMessageRecord({
        type: "loaded",
        request: request,
        isTab: false,
        quality: qualityValue,
        fps: fpsValue,
        backup: backup,
      });
    } catch (error) {
      console.error("Error creating offscreen document:", error);
      await openRecorderTab(activeTab, backup, false, request.camera, request);
    }
  }
};
