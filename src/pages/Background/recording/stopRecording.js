import { focusTab, sendMessageTab } from "../tabManagement/";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { sendMessageRecord } from "./sendMessageRecord";
import { sendChunks } from "./sendChunks";
import { waitForContentScript } from "../utils/waitForContentScript";
import { diagEvent, endDiagSession } from "../../utils/diagnosticLog";

const acquirePostStopEditorLock = async (recordingId = null) => {
  const { postStopEditorOpening } = await chrome.storage.local.get([
    "postStopEditorOpening",
  ]);
  if (postStopEditorOpening) return false;
  await chrome.storage.local.set({
    postStopEditorOpening: true,
    postStopEditorOpened: true,
    postStopRecordingId: recordingId,
  });
  return true;
};

const releasePostStopEditorLock = async (overrides = {}) => {
  await chrome.storage.local.set({
    postStopEditorOpening: false,
    postStopEditorOpened: false,
    ...overrides,
  });
};

export const stopRecording = async () => {
  chrome.action.setIcon({ path: "assets/icon-34.png" });
  chrome.storage.local.set({ restarting: false });
  const { recordingStartTime, isSubscribed, paused, pausedAt, totalPausedMs, recordingDuration: storedDuration } =
    await chrome.storage.local.get([
      "recordingStartTime",
      "isSubscribed",
      "paused",
      "pausedAt",
      "totalPausedMs",
      "recordingDuration",
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

  // Recorder clears recordingStartTime before stopRecording() runs via
  // videoReady(), so the computed duration can be 0 for valid recordings.
  // Fall back to the previously stored recordingDuration if available.
  if (duration === 0 && Number(storedDuration) > 0) {
    duration = Number(storedDuration);
  }
  const maxDuration = 7 * 60 * 1000;

  diagEvent("stop", { duration, isSubscribed: Boolean(isSubscribed) });

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
    diagEvent("editor-open", { type: "editorwebcodecs" });
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
    diagEvent("editor-open", { type: "editorviewer", duration });
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
    diagEvent("editor-open", { type: "editor-ffmpeg" });
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

  // End the diagnostic session for all paths (subscriber, free webcodecs,
  // free viewer, free ffmpeg, and already-opened-editor).  Error/crash paths
  // end the session separately via their own endDiagSession calls.
  endDiagSession("ok");

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
    diagEvent("error", { type: "memory-error" });
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
  const stopTabNow = Date.now();
  const stopTabStartTime = Number(recordingStartTime);
  const stopTabBasePaused = Number(totalPausedMs) || 0;
  const stopTabPausedAtMs = Number(pausedAt);
  const stopTabExtraPaused =
    paused && Number.isFinite(stopTabPausedAtMs) && stopTabPausedAtMs > 0
      ? Math.max(0, stopTabNow - stopTabPausedAtMs)
      : 0;
  const stopTabDuration =
    Number.isFinite(stopTabStartTime) && stopTabStartTime > 0
      ? Math.max(0, stopTabNow - stopTabStartTime - stopTabBasePaused - stopTabExtraPaused)
      : 0;
  diagEvent("stop-tab", { duration: stopTabDuration, reason: request.reason || null, memoryError: Boolean(request.memoryError), fastRecorderInUse: Boolean(fastRecorderInUse) });

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
    const lockAcquired = await acquirePostStopEditorLock(recordingId);
    if (!lockAcquired) {
      console.warn(
        "[Screenity][BG] Duplicate stop-recording-tab suppressed (editor opening)",
      );
      sendMessageRecord({ type: "stop-recording-tab" });
      return;
    }

    if (fastRecorderInUse) {
      diagEvent("editor-open", { type: "editorwebcodecs", via: "stop-tab" });
      const editorUrl = "editorwebcodecs.html";
      // Open editor immediately in postStop mode (WebCodecs only)
      chrome.tabs.create(
        {
          url: `${editorUrl}?mode=postStop&recordingId=${encodeURIComponent(
            recordingId,
          )}`,
          active: true,
        },
        (tab) => {
          if (chrome.runtime.lastError || !tab?.id) {
            console.error(
              "❌ Failed to open post-stop editor:",
              chrome.runtime.lastError?.message || "tab-create-failed",
            );
            releasePostStopEditorLock({ postStopRecordingId: null });
            return;
          }
          chrome.tabs.onUpdated.addListener(function _(
            tabId,
            changeInfo,
            updatedTab,
          ) {
            if (tabId === tab.id && changeInfo.status === "complete") {
              chrome.tabs.onUpdated.removeListener(_);
              chrome.storage.local.set({ sandboxTab: tab.id });
              releasePostStopEditorLock();
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
      diagEvent("editor-open", { type: editorUrl.replace(".html", ""), via: "stop-tab", duration });
      // MediaRecorder/FFmpeg path: open editor normally (no postStop gating)
      chrome.tabs.create({ url: editorUrl, active: true }, (tab) => {
        if (chrome.runtime.lastError || !tab?.id) {
          console.error(
            "❌ Failed to open post-stop editor:",
            chrome.runtime.lastError?.message || "tab-create-failed",
          );
          releasePostStopEditorLock({ postStopRecordingId: null });
          return;
        }
        chrome.tabs.onUpdated.addListener(function _(
          tabId,
          changeInfo,
          updatedTab,
        ) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(_);
            chrome.storage.local.set({
              sandboxTab: tab.id,
              postStopRecordingId: null,
            });
            releasePostStopEditorLock({ postStopRecordingId: null });
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
              (async () => {
                let sent = false;
                for (let i = 0; i < 6; i += 1) {
                  // eslint-disable-next-line no-await-in-loop
                  const result = await sendChunks();
                  if (result?.status === "ok") {
                    sent = true;
                    break;
                  }
                  // eslint-disable-next-line no-await-in-loop
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }
                if (!sent) {
                  console.warn(
                    "[Screenity][BG] editor opened but chunks are still unavailable",
                  );
                  try {
                    await chrome.storage.local.set({
                      lastChunkSendFailure: {
                        ts: Date.now(),
                        why: "editor-opened-no-chunks",
                        targetTabId: tab.id,
                      },
                    });
                  } catch {}
                }
              })();
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
