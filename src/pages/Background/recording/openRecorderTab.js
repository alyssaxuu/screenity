import { getCurrentTab } from "../tabManagement";
import { removeTab } from "../tabManagement/removeTab";
import { sendMessageRecord } from "./sendMessageRecord.js";
import { closeOffscreenDocument } from "../offscreen/closeOffscreenDocument.js";
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
  // end up with two pinned tabs. Only close actual extension recorder pages -
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
      // Tab doesn't exist - just clear the reference
    }
    chrome.storage.local.set({ recordingTab: null });
  }

  const finalUrl = isRegion ? `${recorderUrl}?tab=true` : recorderUrl;

  const tab = await chrome.tabs.create({
    url: finalUrl,
    pinned: true,
    index: 0,
    // FLAG: Check this is ok?
    active: switchTab,
  });

  // Apply autoDiscardable before the load listener so the tab can't be discarded pre-mount.
  let autoDiscardableApplied = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await chrome.tabs.update(tab.id, { autoDiscardable: false });
      autoDiscardableApplied = true;
      break;
    } catch (err) {
      if (attempt === 1) {
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
      } else {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }

  chrome.storage.local.set({
    recordingTab: tab.id,
    offscreen: false,
    region: false,
    wasRegion: true,
    clickEvents: [],
    recordingUiTabId: activeTab.id,
    autoDiscardableApplied,
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
};

export const startRecorderSession = async (request, tabId = null) => {
  console.log("[Screenity][startRecorderSession] entered", { request, tabId });
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

    if (request.customRegion) {
      chrome.storage.local.set({
        recordingTab: activeTab.id,
        offscreen: false,
        region: true,
        recordingUiTabId: activeTab.id,
      });
      sendMessageRecord({
        type: "loaded",
        request: request,
        backup: backup,
        region: true,
      });
    } else {
      chrome.storage.local.set({
        recordingTab: activeTab.id,
        offscreen: false,
        region: true,
        recordingUiTabId: activeTab.id,
      });
      await openRecorderTab(activeTab, backup, true, false, request);
    }
  } else {
    await openRecorderTab(activeTab, backup, false, request.camera, request);
  }
};
