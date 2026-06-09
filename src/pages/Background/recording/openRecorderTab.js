import { getCurrentTab } from "../tabManagement";
import { removeTab } from "../tabManagement/removeTab";
import { sendMessageRecord } from "./sendMessageRecord.js";
import { closeOffscreenDocumentWithFlush } from "../offscreen/closeOffscreenDocumentWithFlush";
import { createCloudRecorderOffscreen } from "../offscreen/createCloudRecorderOffscreen.js";
import { loginWithWebsite } from "../auth/loginWithWebsite.js";
import { traceStep } from "../../utils/startFlowTrace.js";
import { handleGetStreamingData } from "./recordingHelpers.js";
import { perfMark, perfSpan } from "../../utils/perfMarks";
import { sweepRecorderTabs } from "./sweepRecorderTabs";

const openRecorderTab = async (
  activeTab,
  isRegion,
  camera = false,
  request
) => {
  perfMark("BG.openRecorderTab.enter", {
    isRegion,
    camera,
    activeTabId: activeTab?.id || null,
  });
  let switchTab = true;

  const endLogin = perfSpan("BG.openRecorderTab loginWithWebsite");
  const { authenticated, subscribed, cached, transient, error: authError } = await loginWithWebsite({ force: true });
  endLogin({ authenticated, subscribed, cached: Boolean(cached) });
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

  // cloud recordings need the tab active briefly so keepalive can start
  if (isCloudRecorder && !switchTab) {
    switchTab = true;
  }

  // Region recordings point recordingTab at the user's tab; never close that.
  // For cloudrecorder.html, also skip removal while the previous session is
  // still uploading: killing it mid-TUS-upload corrupts scene data. It
  // closes itself via window.close() when finalize lands.
  const {
    recordingTab: prevRecTab,
    recorderSession: prevSession,
  } = await chrome.storage.local.get(["recordingTab", "recorderSession"]);
  if (prevRecTab != null) {
    try {
      const prevTab = await chrome.tabs.get(prevRecTab);
      const prevUrl = prevTab?.url || "";
      const isCloudRecorderTab = prevUrl.includes("cloudrecorder.html");
      const isFreeRecorderTab =
        prevUrl.includes("recorder.html") && !isCloudRecorderTab;
      const prevSessionStatus = prevSession?.status || null;
      const stillFinalizing =
        prevSessionStatus === "recording" ||
        prevSessionStatus === "stopping" ||
        prevSessionStatus === "finishing";
      if (isFreeRecorderTab) {
        await removeTab(prevRecTab);
      } else if (isCloudRecorderTab && !stillFinalizing) {
        await removeTab(prevRecTab);
      }
    } catch {}
    chrome.storage.local.set({ recordingTab: null });
  }

  // offscreen host escapes background-tab freeze/discard. useOffscreenCloud is a
  // kill-switch (default ON; false forces the old tab host). recordingType isn't
  // on the desktop-capture message, content UI writes it to storage first.
  const { useOffscreenCloud, recordingType: storedRecordingType, customRegion: storedCustomRegion } =
    await chrome.storage.local.get(["useOffscreenCloud", "recordingType", "customRegion"]);
  const recordingType = request?.recordingType ?? storedRecordingType ?? null;
  const customRegion = request?.customRegion ?? storedCustomRegion ?? false;
  // all modes run offscreen except customRegion: its track.cropTo(CropTarget)
  // needs an iframe inside the recorded tab and can't run in an offscreen doc.
  const willUseOffscreen = useOffscreenCloud !== false && !customRegion;
  perfMark("BG.openRecorderTab offscreen-decision", {
    isCloudRecorder,
    isRegion,
    camera,
    recordingType,
    willUseOffscreen,
  });
  if (willUseOffscreen) {
    perfMark("BG.openRecorderTab offscreen-route", { camera });
    try {
      await createCloudRecorderOffscreen({ cloud: isCloudRecorder });
    } catch (err) {
      console.error(
        "[Screenity][BG] openRecorderTab: offscreen create failed",
        err,
      );
      chrome.runtime
        .sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: "offscreen create failed: " + String(err?.message || err),
          errorCode: "REC_START_NO_OFFSCREEN",
        })
        .catch(() => {});
      return;
    }
    // offscreen:true routes sendMessageRecord to the offscreen doc; set before
    // the loaded push. tab/region need a tabCapture streamId, but offscreen can't
    // call chrome.tabCapture so it requests one from the SW via the tabID below.
    const isTabCapture = recordingType === "tab" || isRegion;
    await chrome.storage.local.set({
      recordingTab: null,
      offscreen: true,
      region: false,
      wasRegion: false,
      clickEvents: [],
      recordingUiTabId: activeTab.id,
    });
    traceStep("recorderOffscreenCreated");
    perfMark("BG.openRecorderTab offscreen-loaded.send");
    const loadedMsg = {
      type: "loaded",
      request: request,
      tabPreferred: false,
      ...(isTabCapture ? { isTab: true, tabID: activeTab.id } : {}),
    };
    // offscreen React app mounts its listener async, so early sends are lost; retry
    (async () => {
      const backoffMs = [0, 150, 300, 600, 1000, 1500, 2500];
      for (let attempt = 0; attempt < backoffMs.length; attempt += 1) {
        if (backoffMs[attempt] > 0) {
          await new Promise((r) => setTimeout(r, backoffMs[attempt]));
        }
        try {
          await sendMessageRecord(loadedMsg);
          return;
        } catch {
          // offscreen recorder not ready yet; retry
        }
      }
      console.warn(
        "[Screenity][BG] offscreen recorder loaded-send exhausted retries",
      );
    })();
    setTimeout(() => {
      handleGetStreamingData().catch(() => {});
    }, 300);
    return;
  }

  const finalUrl = isRegion ? `${recorderUrl}?tab=true` : recorderUrl;

  // Close leftover setup.html tabs to prevent them stealing focus from
  // the editor after recording stops. Fire-and-forget; the tab cleanup
  // doesn't need to gate tabs.create below, and chrome.tabs.query({})
  // can take 50-100ms on a tab-heavy browser.
  (async () => {
    try {
      const setupUrl = chrome.runtime.getURL("setup.html");
      const allTabs = await chrome.tabs.query({});
      const stale = allTabs.filter(
        (t) =>
          t.id != null &&
          t.id !== activeTab?.id &&
          t.url &&
          t.url.startsWith(setupUrl),
      );
      if (stale.length > 0) {
        await chrome.tabs.remove(stale.map((t) => t.id));
      }
    } catch {}
  })();

  const endTabCreate = perfSpan("BG.openRecorderTab tabs.create");
  const tab = await chrome.tabs.create({
    url: finalUrl,
    pinned: true,
    index: 0,
    active: switchTab,
  });
  endTabCreate({ tabId: tab?.id });
  // tabs.create can fulfill with no id in rare MV3 states (window-closed, profile-locked)
  if (!tab || typeof tab.id !== "number") {
    console.error(
      "[Screenity][BG] openRecorderTab: tabs.create returned no usable tab",
      tab,
    );
    chrome.runtime
      .sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: "recorder tab create returned no id",
        errorCode: "REC_START_NO_TAB",
      })
      .catch(() => {});
    return;
  }

  // Set recordingTab before the autoDiscardable retry loop (up to ~1.25s
  // of awaits) so listeners that fire during it don't see a stale tab id.
  chrome.storage.local.set({
    recordingTab: tab.id,
    offscreen: false,
    region: false,
    wasRegion: true,
    clickEvents: [],
    recordingUiTabId: activeTab.id,
    ...(isRegion ? { tabRecordedID: activeTab.id } : {}),
  });

  // Remove any earlier recorder tab the prevRecTab check above could not
  // see (a second tab from a countdown/fallback race). Spare the tab we
  // just created.
  await sweepRecorderTabs({ exceptTabId: tab.id });

  // under memory pressure the set can succeed silently while the property stays true;
  // verify via tabs.get roundtrip and retry with backoff
  let autoDiscardableApplied = false;
  let autoDiscardableVerified = false;
  const backoffsMs = [50, 200, 1000];
  for (let attempt = 0; attempt < backoffsMs.length; attempt += 1) {
    try {
      await chrome.tabs.update(tab.id, { autoDiscardable: false });
      autoDiscardableApplied = true;
      try {
        const tabState = await chrome.tabs.get(tab.id);
        if (tabState && tabState.autoDiscardable === false) {
          autoDiscardableVerified = true;
          break;
        }
      } catch {}
    } catch (err) {
      if (attempt === backoffsMs.length - 1) {
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
      }
    }
    if (attempt < backoffsMs.length - 1) {
      await new Promise((r) => setTimeout(r, backoffsMs[attempt]));
    }
  }

  chrome.storage.local.set({
    autoDiscardableApplied,
    autoDiscardableVerified,
  });

  chrome.tabs.onUpdated.addListener(function _(tabId, changeInfo) {
    if (tabId === tab.id && changeInfo.status === "complete") {
      chrome.tabs.onUpdated.removeListener(_);
      perfMark("BG.openRecorderTab tab-status-complete", { tabId });
      traceStep("recorderTabCreated");
      // tabPreferred lets CloudRecorder use it synchronously without racing storage
      const isPlayground = activeTab.url.includes(
        chrome.runtime.getURL("playground.html")
      );
      perfMark("BG.openRecorderTab loaded.sent");
      // `loaded` is sent at status:complete, before the recorder's React
      // app has mounted its message listener, so the first send is
      // routinely lost. It carries isTab/tabID for region recordings, so
      // retry until the recorder is listening. (streaming-data no longer
      // depends on `loaded`; the recorder pulls it on mount.)
      const loadedMsg = {
        type: "loaded",
        request: request,
        tabPreferred: isPlayground,
        ...(isRegion
          ? {
              isTab: true,
              tabID: activeTab.id,
            }
          : {}),
      };
      console.warn(
        "[Screenity][openRecorderTab] loadedMsg",
        JSON.stringify({
          isRegion,
          camera,
          activeTabId: activeTab.id,
          isPlayground,
          requestRegion: !!request?.region,
          requestCustomRegion: !!request?.customRegion,
          requestRecordingType: request?.recordingType || null,
          loadedHasIsTab: !!loadedMsg.isTab,
          loadedTabID: loadedMsg.tabID || null,
        }),
      );
      (async () => {
        const backoffMs = [0, 200, 500, 1000, 2000];
        for (let attempt = 0; attempt < backoffMs.length; attempt += 1) {
          if (backoffMs[attempt] > 0) {
            await new Promise((r) => setTimeout(r, backoffMs[attempt]));
          }
          try {
            await sendMessageRecord(loadedMsg);
            return;
          } catch {
            // recorder tab not ready yet; retry
          }
        }
      })();
      // Belt-and-suspenders push; the recorder's own pull is the primary
      // path now.
      setTimeout(() => {
        handleGetStreamingData().catch(() => {});
      }, 300);
    }
  });
};

export const startRecorderSession = async (request, tabId = null) => {
  perfMark("BG.startRecorderSession.enter", {
    customRegion: Boolean(request?.customRegion),
    region: Boolean(request?.region),
    camera: Boolean(request?.camera),
  });
  console.log("[Screenity][startRecorderSession] entered", { request, tabId });
  const endTab = perfSpan("BG.startRecorderSession getCurrentTab");
  let activeTab = await getCurrentTab();
  endTab({ tabId: activeTab?.id || null });

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

  const endCloseOffscreen = perfSpan("BG.startRecorderSession closeOffscreenDocument");
  // finalize any in-flight offscreen upload before teardown; a back-to-back
  // start otherwise bare-closes the prior TUS finalize and loses it
  await closeOffscreenDocumentWithFlush({ reason: "new-recording-start" });
  endCloseOffscreen();

  if (request.region) {
    if (tabId !== null) chrome.tabs.update(tabId, { active: true });

    if (request.customRegion) {
      chrome.storage.local.set({
        recordingTab: activeTab.id,
        offscreen: false,
        region: true,
        recordingUiTabId: activeTab.id,
      });
      const endSendLoaded = perfSpan("BG.startRecorderSession customRegion.sendLoaded");
      sendMessageRecord({
        type: "loaded",
        request: request,
        region: true,
      })
        .then(() => endSendLoaded({ ok: true }))
        .catch((err) =>
          endSendLoaded({
            ok: false,
            err: String(err?.message || err).slice(0, 100),
          }),
        );
    } else {
      chrome.storage.local.set({
        recordingTab: activeTab.id,
        offscreen: false,
        region: true,
        recordingUiTabId: activeTab.id,
      });
      await openRecorderTab(activeTab, true, false, request);
    }
  } else {
    chrome.storage.local.set({ region: false });
    await openRecorderTab(activeTab, false, request.camera, request);
  }
};
