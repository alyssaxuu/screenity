import {
  sendMessageTab,
  focusTab,
  removeTab,
  getCurrentTab,
} from "../tabManagement";
import { sendMessageRecord } from "./sendMessageRecord";
import { stopRecording } from "./stopRecording";
import { addAlarmListener } from "../alarms/addAlarmListener";
import { getStreamingData } from "./getStreamingData";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { diagEvent, endDiagSession } from "../../utils/diagnosticLog";
import { perfMark, perfSpan } from "../../utils/perfMarks";
import { classifyError } from "../../utils/errorCodes";
import { resetWatchdogState } from "./resetWatchdogState";
import { sweepRecorderTabs } from "./sweepRecorderTabs";

// Mirrors CloudRecorder.appendUploadTelemetryEvent so BG-side projectId mutations
// land in the same `cloudUploadTelemetryEvents` storage key surfaced by
// buildDiagnosticZip → upload-telemetry.json. Diagnostic-only; best-effort.
const BG_UPLOAD_TELEMETRY_KEY = "cloudUploadTelemetryEvents";
const BG_UPLOAD_TELEMETRY_MAX = 300;
const appendBgUploadTelemetryEvent = async (payload) => {
  try {
    const existing = await chrome.storage.local.get([BG_UPLOAD_TELEMETRY_KEY]);
    const current = Array.isArray(existing?.[BG_UPLOAD_TELEMETRY_KEY])
      ? existing[BG_UPLOAD_TELEMETRY_KEY]
      : [];
    const eventPayload = {
      ts: Date.now(),
      uploaderType: "bg_recording",
      ...payload,
    };
    const next = [...current, eventPayload].slice(-BG_UPLOAD_TELEMETRY_MAX);
    await chrome.storage.local.set({
      [BG_UPLOAD_TELEMETRY_KEY]: next,
      lastUploadTelemetryEvent: eventPayload,
    });
  } catch {
    // best-effort; telemetry must never break recording
  }
};

export const checkCapturePermissions = async ({ isLoggedIn, isSubscribed }) => {
  const permissions = ["desktopCapture", "alarms", "offscreen"];

  if (isLoggedIn && isSubscribed) {
    permissions.push("clipboardWrite");
  }

  // MUST be the first await; preceding awaits consume the user-gesture context
  // and Chrome rejects request() with "must be called during a user gesture"
  const granted = await new Promise((resolve) => {
    chrome.permissions.request({ permissions }, resolve);
  });

  if (granted) {
    addAlarmListener();
    return { status: "ok" };
  } else {
    return { status: "error" };
  }
};

export const handlePip = async (started = false) => {
  const { activeTab } = await chrome.storage.local.get(["activeTab"]);
  if (started) {
    sendMessageTab(activeTab, { type: "pip-started" });
  } else {
    sendMessageTab(activeTab, { type: "pip-ended" });
  }
};

export const handleOnGetPermissions = async (request) => {
  const activeTab = await getCurrentTab();
  if (activeTab) {
    sendMessageTab(activeTab.id, {
      type: "on-get-permissions",
      data: request,
    });
  }
};

export const handleRecordingComplete = async () => {
  perfMark("BG.recordingHelpers handleRecordingComplete.enter");
  const { recordingTab, completingRecordingTab } =
    await chrome.storage.local.get([
      "recordingTab",
      "completingRecordingTab",
    ]);

  // snapshot at stop time; live recordingTab may belong to a new session by now
  const target = completingRecordingTab ?? null;

  if (target) {
    chrome.tabs.get(target, (tab) => {
      if (chrome.runtime.lastError || !tab) return;
      if (
        tab.url.includes("chrome-extension") &&
        tab.url.includes("recorder.html")
      ) {
        removeTab(target);
      }
    });
  }

  // null recordingTab only if still pointing at the tab we just finished
  const updates = { offscreen: false, completingRecordingTab: null };
  if (target != null && recordingTab === target) {
    updates.recordingTab = null;
  }
  chrome.storage.local.set(updates);
  console.log(
    "[Screenity][BG] handleRecordingComplete fired",
    { target, liveRecordingTab: recordingTab, cleared: target === recordingTab },
  );
};

export const handleRecordingError = async (request) => {
  console.warn("[Screenity][handleRecordingError]", request);

  const errorCode =
    request?.errorCode ||
    classifyError(request?.why || "", request?.error || "");

  try {
    const { recordingAttemptId } = await chrome.storage.local.get([
      "recordingAttemptId",
    ]);
    await chrome.storage.local.set({
      lastRecordingError: {
        ts: Date.now(),
        error: request?.error || null,
        why: request?.why || null,
        errorCode,
        recordingAttemptId: recordingAttemptId || null,
      },
    });
  } catch {}
  const { activeTab, recordingUiTabId, tabRecordedID } =
    await chrome.storage.local.get([
      "activeTab",
      "recordingUiTabId",
      "tabRecordedID",
    ]);

  await chrome.storage.local.set({
    pendingRecording: false,
  });

  const isWarningOnly = request.error === "stream-ended";
  diagEvent(isWarningOnly ? "warning" : "error", {
    error: request?.error || null,
    why: request?.why || null,
    errorCode,
  });

  // stream-ended: notify only, never stop. user decides whether to continue
  if (isWarningOnly) {
    sendMessageTab(activeTab, {
      type: "stream-ended-warning",
      message: request.why || chrome.i18n.getMessage("streamEndedWarningToast"),
    }).catch((err) => {
      diagEvent("warning", { note: "stream-ended-warning undelivered", err: String(err).slice(0, 80) });
    });
    return;
  }

  endDiagSession("error");

  // mirrors discardRecording: 1+ scenes saved -> preserve project for retry
  const {
    multiMode,
    multiSceneCount,
    projectId: projectIdBeforeClear,
    sceneId: sceneIdBeforeClear,
    recordingAttemptId: attemptIdAtClear,
  } = await chrome.storage.local.get([
    "multiMode",
    "multiSceneCount",
    "projectId",
    "sceneId",
    "recordingAttemptId",
  ]);
  const preserveMultiProject =
    Boolean(multiMode) && Number(multiSceneCount) > 0;
  // sceneId/sceneIdStatus/pendingSceneIndex must clear with projectId. Otherwise a
  // retry attempt inherits a sceneId tied to a project that no longer exists, and
  // the cloudrecorder reaches startRecording with projectId=null while sceneIdStatus
  // still says "recording". See the no-project-id failure pattern in diagnostics.
  const multiState = preserveMultiProject
    ? {}
    : {
        multiMode: false,
        multiSceneCount: 0,
        multiProjectId: null,
        multiLastSceneId: null,
        recordingToScene: false,
        projectId: null,
        activeSceneId: null,
        sceneId: null,
        sceneIdStatus: null,
        pendingSceneIndex: null,
      };

  await chrome.storage.local.set({
    recording: false,
    recordingUiTabId: null,
    tabRecordedID: null,
    offscreen: false,
    postStopEditorOpened: false,
    // releases the editor-opening lock; otherwise next stopRecording refuses to open editor
    postStopEditorOpening: false,
    region: false,
    customRegion: false,
    // PiP + pause must follow recording down; otherwise next session inherits paused=true
    pipForceClose: Date.now(),
    paused: false,
    pausedAt: null,
    totalPausedMs: 0,
    ...multiState,
  });

  if (!preserveMultiProject && projectIdBeforeClear) {
    void appendBgUploadTelemetryEvent({
      event: "project_state_change",
      source: "bg-recording-error",
      from: projectIdBeforeClear,
      to: null,
      sceneId: sceneIdBeforeClear || null,
      reason: request?.error || "recording-error",
      why: request?.why || null,
      errorCode,
      recordingAttemptId: attemptIdAtClear || null,
    });
  }

  chrome.runtime.sendMessage({ type: "turn-off-pip" }).catch(() => {});

  chrome.runtime
    .sendMessage({
      type: "clear-recording-session-safe",
      reason: "recording-error-terminal",
    })
    .catch((err) => {
      diagEvent("warning", { note: "clear-session-safe undelivered", err: String(err).slice(0, 80) });
    });

  // sandboxed editor: runtime.onMessage unreliable, storage.onChanged fires.
  // try message first, ALWAYS write the storage flag.
  const { sandboxTab } = await chrome.storage.local.get(["sandboxTab"]);
  let sandboxAlive = false;
  if (Number.isInteger(sandboxTab)) {
    try {
      await chrome.tabs.get(sandboxTab);
      sandboxAlive = true;
      sendMessageTab(sandboxTab, {
        type: "recording-error",
        error: request?.error || null,
        why: request?.why || null,
        errorCode,
      }).catch(() => {});
    } catch {}
  }
  // a later-mounting editor reads this on boot to surface the modal;
  // sandboxTab filters stale entries from prior sessions
  try {
    await chrome.storage.local.set({
      editorRecordingError: {
        ts: Date.now(),
        sandboxTab: Number.isInteger(sandboxTab) ? sandboxTab : null,
        error: request?.error || null,
        why: request?.why || null,
        errorCode,
      },
    });
  } catch {}

  sendMessageRecord({ type: "recording-error" }).then(() => {
    const candidateTabs = [activeTab, recordingUiTabId, tabRecordedID].filter(
      (id, idx, arr) => Number.isInteger(id) && arr.indexOf(id) === idx,
    );
    candidateTabs.forEach((id) => {
      sendMessageTab(id, { type: "stop-pending" }).catch(() => {});
    });
    // refocus only when no editor is open
    if (!sandboxAlive) {
      focusTab(activeTab);
    }
    if (request.error === "stream-error") {
      sendMessageTab(activeTab, { type: "stream-error", errorCode });
    } else if (request.error === "backup-error") {
      sendMessageTab(activeTab, { type: "backup-error", errorCode });
    }
  });

  const { recordingTab } = await chrome.storage.local.get(["recordingTab"]);
  if (recordingTab) {
    try {
      const tab = await chrome.tabs.get(recordingTab);
      if (tab?.url?.startsWith(chrome.runtime.getURL(""))) {
        removeTab(recordingTab);
      }
    } catch {}
  }
  // recordingTab names at most one recorder tab; sweep catches any other
  // recorder tab a racing start may have spawned and orphaned.
  await sweepRecorderTabs();
  chrome.storage.local.set({ recordingTab: null });
  try {
    await discardOffscreenDocuments();
  } catch {}
  await resetWatchdogState();
};

// Push streaming-data to the recorder tab. Used for the SW-initiated
// path (openRecorderTab). Dropped delivery causes REC_START_NO_STREAM_MSG
// at the tab's 12s gate; the tab side is idempotent so retries are safe.
const pushStreamingData = async (dataStr) => {
  const payload = { type: "streaming-data", data: dataStr };
  const backoffMs = [0, 300, 800];
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    if (backoffMs[attempt] > 0) {
      await new Promise((r) => setTimeout(r, backoffMs[attempt]));
    }
    try {
      await sendMessageRecord(payload);
      if (attempt > 0) {
        diagEvent("sw-streaming-data-send-ok", { attempt });
      }
      return;
    } catch (err) {
      diagEvent("sw-streaming-data-send-fail", {
        attempt,
        err: String(err?.message || err).slice(0, 120),
      });
      if (attempt === backoffMs.length - 1) {
        console.warn("handleGetStreamingData: all push attempts failed", err);
      }
    }
  }
};

export const handleGetStreamingData = async () => {
  perfMark("BG.handleGetStreamingData.enter");
  const data = await getStreamingData();
  const dataStr = JSON.stringify(data);
  // Fire-and-forget push (SW-initiated openRecorderTab path). Not awaited:
  // a `get-streaming-data` pull must get its response immediately, not
  // after the push retry loop.
  void pushStreamingData(dataStr);
  // Returned to a `get-streaming-data` pull as the direct response. This
  // is the robust delivery path — it does not depend on the recorder
  // tab's onMessage listener being registered yet, nor on `recordingTab`
  // routing being correct.
  return { ok: true, data: dataStr };
};

export const videoReady = async () => {
  perfMark("BG.recordingHelpers videoReady.enter");
  const { backupTab, recordingDuration, recordingTab, lastRecordingBackendRef } =
    await chrome.storage.local.get([
      "backupTab",
      "recordingDuration",
      "recordingTab",
      "lastRecordingBackendRef",
    ]);
  diagEvent("sw-received-video-ready", {
    recordingDurationMs: Number(recordingDuration) || 0,
    backupTabPresent: Boolean(backupTab),
  });
  if (backupTab) {
    sendMessageTab(backupTab, { type: "close-writable" });
  }
  chrome.runtime
    .sendMessage({
      type: "clear-recording-session-safe",
      reason: "video-ready-terminal",
    })
    .catch((err) => {
      diagEvent("warning", { note: "clear-session-safe undelivered (video-ready)", err: String(err).slice(0, 80) });
    });
  // For OPFS the editor reads chunks directly, so the recorder tab can
  // close as soon as video-ready fires. Keeping it alive holds Chrome's
  // tab-capture binding, which makes the next getMediaStreamId reject
  // with "Cannot capture a tab with an active stream" until Chrome
  // restarts. Cloudrecorder runs its own close on finalize, so skip it.
  if (lastRecordingBackendRef?.backend === "opfs" && recordingTab) {
    try {
      const tab = await chrome.tabs.get(recordingTab).catch(() => null);
      const tabUrl = tab?.url ? new URL(tab.url) : null;
      const isFreeRecorder =
        tabUrl?.pathname === "/recorder.html" &&
        tabUrl?.origin === chrome.runtime.getURL("").replace(/\/$/, "");
      if (isFreeRecorder) {
        diagEvent("eager-recorder-close", {
          recordingTab,
          reason: "video-ready-opfs",
        });
        await chrome.tabs.remove(recordingTab).catch(() => {});
        chrome.storage.local.set({ recordingTab: null });
      }
    } catch (closeErr) {
      diagEvent("warning", {
        note: "eager-recorder-close failed",
        err: String(closeErr?.message || closeErr).slice(0, 120),
      });
    }
  }
  await stopRecording();
};

export const writeFile = async (request) => {
  const { backupTab } = await chrome.storage.local.get(["backupTab"]);

  if (backupTab) {
    sendMessageTab(
      backupTab,
      {
        type: "write-file",
        index: request.index,
      },
      null,
      () => {
        sendMessageRecord({ type: "stop-recording-tab" });
      },
    );
  } else {
    sendMessageRecord({ type: "stop-recording-tab" });
  }
};
