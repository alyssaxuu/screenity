import { getCurrentTab } from "../tabManagement";
import { removeTab } from "../tabManagement/removeTab";
import { sendMessageRecord } from "../recording/sendMessageRecord.js";
import { closeOffscreenDocument } from "./closeOffscreenDocument.js";
import { loginWithWebsite } from "../auth/loginWithWebsite.js";
import { traceStep } from "../../utils/startFlowTrace.js";

const openRecorderTab = async (
  activeTab,
  backup,
  isRegion,
  camera = false,
  request
) => {
  let switchTab = true;

  // Check subscription status
  const { authenticated, subscribed, cached, transient, error: authError } = await loginWithWebsite();
  const isCloudRecorder = authenticated && subscribed;
  const recorderUrl = isCloudRecorder
      ? chrome.runtime.getURL("cloudrecorder.html")
      : chrome.runtime.getURL("recorder.html");
  if (!isRegion) {
    if (camera) {
      switchTab = false;
    }
  } else {
    switchTab = activeTab.url.includes(
      chrome.runtime.getURL("playground.html")
    );
  }

  // Cloud recordings need the tab active briefly so keepalive can start
  if (isCloudRecorder && !switchTab) {
    switchTab = true;
  }

  // Close any leftover recorder tab from a previous recording so we don't
  // end up with two pinned tabs. Only close actual extension recorder pages —
  // for region recordings, recordingTab can temporarily point to the user's
  // active page, which we must NOT close.
  const { recordingTab: prevRecTab } = await chrome.storage.local.get([
    "recordingTab",
  ]);
  if (prevRecTab != null) {
    try {
      const prevTab = await chrome.tabs.get(prevRecTab);
      const prevUrl = prevTab?.url || "";
      if (
        prevUrl.includes("recorder.html") ||
        prevUrl.includes("cloudrecorder.html")
      ) {
        await removeTab(prevRecTab);
      }
    } catch {
      // Tab doesn't exist — just clear the reference
    }
    chrome.storage.local.set({ recordingTab: null });
  }

  const finalUrl = isRegion ? `${recorderUrl}?tab=true` : recorderUrl;

  chrome.tabs
    .create({
      url: finalUrl,
      pinned: true,
      index: 0,
      // FLAG: Check this is ok?
      active: switchTab,
    })
    .then((tab) => {
      // Prevent Chrome from discarding this tab during recording
      chrome.tabs.update(tab.id, { autoDiscardable: false }).catch((err) => {
        console.warn(
          "[Screenity] autoDiscardable failed for recorder tab",
          tab.id,
          String(err),
        );
        chrome.storage.local.set({
          lastAutoDiscardableError: {
            ts: Date.now(),
            tabId: tab.id,
            error: String(err),
          },
        });
      });

      chrome.storage.local.set({
        recordingTab: tab.id,
        offscreen: false,
        region: false,
        wasRegion: true,
        clickEvents: [],
        recordingUiTabId: activeTab.id,
        ...(isRegion ? { tabRecordedID: activeTab.id } : {}),
      });

      chrome.tabs.onUpdated.addListener(function _(tabId, changeInfo) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(_);
          traceStep("recorderTabCreated");
          // Include tabPreferred in the message so CloudRecorder can use it
          // synchronously without racing against its own storage read.
          const isPlayground = activeTab.url.includes(
            chrome.runtime.getURL("playground.html")
          );
          sendMessageRecord({
            type: "loaded",
            request: request,
            backup: backup,
            tabPreferred: isPlayground,
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

export const offscreenDocument = async (request, tabId = null) => {
  const { backup } = await chrome.storage.local.get(["backup"]);
  let activeTab = await getCurrentTab();

  if (tabId !== null) {
    activeTab = await chrome.tabs.get(tabId);
  }

  chrome.storage.local.set({
    activeTab: activeTab.id,
    tabRecordedID: null,
    memoryError: false,
    recordingUiTabId: activeTab.id,
  });

  if (activeTab.url.includes(chrome.runtime.getURL("playground.html"))) {
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
      recordingUiTabId: activeTab.id,
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
        recordingUiTabId: activeTab.id,
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
