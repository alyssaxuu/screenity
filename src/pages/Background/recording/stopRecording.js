import { focusTab, sendMessageTab } from "../tabManagement/";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { sendMessageRecord } from "./sendMessageRecord";
import { sendChunks } from "./sendChunks";
import { waitForContentScript } from "../utils/waitForContentScript";

export const stopRecording = async () => {
  chrome.action.setIcon({ path: "assets/icon-34.png" });
  chrome.storage.local.set({ restarting: false });
  const { recordingStartTime, isSubscribed, paused, pausedAt, totalPausedMs } =
    await chrome.storage.local.get([
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
  chrome.storage.local.set({ recordingUiTabId: null });
  chrome.storage.local.set({ pipForceClose: Date.now() });

  chrome.storage.local.set({ recordingStartTime: 0 });

  const {
    fastRecorderInUse,
    fastRecorderActiveRecordingId,
    fastRecorderValidation,
  } = await chrome.storage.local.get([
    "fastRecorderInUse",
    "fastRecorderActiveRecordingId",
    "fastRecorderValidation",
  ]);
  const validation =
    fastRecorderValidation && typeof fastRecorderValidation === "object"
      ? fastRecorderValidation
      : null;
  const validationMatches =
    validation?.details?.recordingId &&
    validation.details.recordingId === fastRecorderActiveRecordingId;
  const hardFailForCurrent = Boolean(validationMatches && validation?.hardFail);
  //const hasWebCodecs = supportsWebCodecs();
  const hasWebCodecs = Boolean(fastRecorderInUse) && !hardFailForCurrent;

  const {
    postStopEditorOpened,
    postStopEditorOpening,
    sandboxTab,
    postStopRecordingId,
    recordingTab,
  } = await chrome.storage.local.get([
    "postStopEditorOpened",
    "postStopEditorOpening",
    "sandboxTab",
    "postStopRecordingId",
    "recordingTab",
  ]);

  if (isSubscribed) {
    chrome.alarms.clear("recording-alarm");
    discardOffscreenDocuments();
    chrome.storage.local.remove(["recordingMeta"]);
  } else if (postStopEditorOpening || postStopEditorOpened || recordingTab) {
    // Editor already opened by stop-recording-tab flow; avoid opening a second tab.
    // That flow will trigger processing when the tab finishes loading.
  } else if (hasWebCodecs) {
    // Use Mediabunny (editorwebcodecs.html) when WebCodecs is supported
    const query = postStopRecordingId
      ? `?mode=postStop&recordingId=${encodeURIComponent(postStopRecordingId)}`
      : "?mode=postStop";
    chrome.tabs.create(
      { url: `editorwebcodecs.html${query}`, active: true },
      (tab) => {
        chrome.tabs.onUpdated.addListener(function _(
          tabId,
          changeInfo,
          updatedTab,
        ) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(_);
            chrome.storage.local.set({ sandboxTab: tab.id });
            (async () => {
              try {
                await waitForContentScript(tab.id);
                await sendMessageTab(tab.id, { type: "fallback-recording" });
              } catch (err) {
                console.error("❌ Failed to wait/send to content script:", err);
              }
            })();
          }
        });
      },
    );

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } else if (duration > maxDuration) {
    // Fallback for large recordings without WebCodecs - use viewer mode

    const query = postStopRecordingId
      ? `?mode=postStop&recordingId=${encodeURIComponent(postStopRecordingId)}`
      : "?mode=postStop";
    chrome.tabs.create(
      { url: `editorviewer.html${query}`, active: true },
      (tab) => {
        chrome.tabs.onUpdated.addListener(function _(
          tabId,
          changeInfo,
          updatedTab,
        ) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(_);
            chrome.storage.local.set({ sandboxTab: tab.id });
            (async () => {
              try {
                await waitForContentScript(tab.id);
                await sendMessageTab(tab.id, { type: "viewer-recording" });
              } catch (err) {
                console.error("❌ Failed to wait/send to content script:", err);
              }
            })();
          }
        });
      },
    );

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } else {
    // Use FFmpeg (editor.html) for browsers without WebCodecs
    const query = postStopRecordingId
      ? `?mode=postStop&recordingId=${encodeURIComponent(postStopRecordingId)}`
      : "?mode=postStop";
    chrome.tabs.create({ url: `editor.html${query}`, active: true }, (tab) => {
      chrome.tabs.onUpdated.addListener(function _(
        tabId,
        changeInfo,
        updatedTab,
      ) {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(_);
          chrome.storage.local.set({ sandboxTab: tab.id });
          (async () => {
            try {
              await waitForContentScript(tab.id);
              await sendMessageTab(tab.id, { type: "fallback-recording" });
            } catch (err) {
              console.error("❌ Failed to wait/send to content script:", err);
            }
          })();
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

  const {
    isSubscribed,
    recordingStartTime,
    paused,
    pausedAt,
    totalPausedMs,
    fastRecorderInUse,
  } = await chrome.storage.local.get([
    "isSubscribed",
    "recordingStartTime",
    "paused",
    "pausedAt",
    "totalPausedMs",
    "fastRecorderInUse",
  ]);
  if (!isSubscribed) {
    const { fastRecorderActiveRecordingId } = await chrome.storage.local.get([
      "fastRecorderActiveRecordingId",
    ]);
    const recordingId =
      fastRecorderActiveRecordingId ||
      `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const now = Date.now();
    const startTime = Number(recordingStartTime);
    const basePaused = Number(totalPausedMs) || 0;
    const pausedAtMs = Number(pausedAt);
    const extraPaused =
      paused && Number.isFinite(pausedAtMs) && pausedAtMs > 0
        ? Math.max(0, now - pausedAtMs)
        : 0;
    const duration =
      Number.isFinite(startTime) && startTime > 0
        ? Math.max(0, now - startTime - basePaused - extraPaused)
        : 0;
    const maxDuration = 7 * 60 * 1000;
    if (fastRecorderInUse) {
      const editorUrl = "editorwebcodecs.html";
      await chrome.storage.local.set({
        postStopEditorOpening: true,
        postStopEditorOpened: true,
        postStopRecordingId: recordingId,
      });
      // Open editor immediately in postStop mode (WebCodecs only)
      chrome.tabs.create(
        {
          url: `${editorUrl}?mode=postStop&recordingId=${encodeURIComponent(
            recordingId,
          )}`,
          active: true,
        },
        (tab) => {
          if (!tab?.id) return;
          chrome.tabs.onUpdated.addListener(function _(
            tabId,
            changeInfo,
            updatedTab,
          ) {
            if (tabId === tab.id && changeInfo.status === "complete") {
              chrome.tabs.onUpdated.removeListener(_);
              chrome.storage.local.set({
                sandboxTab: tab.id,
                postStopEditorOpening: false,
                postStopEditorOpened: false,
              });
              sendMessageTab(tab.id, { type: "fallback-recording" }).catch(
                (err) => {
                  console.error(
                    "❌ Failed to send message:",
                    err?.message || err,
                  );
                },
              );
            }
          });
        },
      );
    } else {
      const editorUrl =
        duration > maxDuration ? "editorviewer.html" : "editor.html";
      // MediaRecorder/FFmpeg path: open editor normally (no postStop gating)
      chrome.tabs.create({ url: editorUrl, active: true }, (tab) => {
        if (!tab?.id) return;
        chrome.tabs.onUpdated.addListener(function _(
          tabId,
          changeInfo,
          updatedTab,
        ) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(_);
            chrome.storage.local.set({
              sandboxTab: tab.id,
              postStopEditorOpening: false,
              postStopEditorOpened: false,
              postStopRecordingId: null,
            });
            if (editorUrl === "editorviewer.html") {
              sendMessageTab(tab.id, { type: "viewer-recording" }).catch(
                (err) => {
                  console.error(
                    "❌ Failed to send message:",
                    err?.message || err,
                  );
                },
              );
            } else {
              sendChunks();
            }
          }
        });
      });
    }
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
