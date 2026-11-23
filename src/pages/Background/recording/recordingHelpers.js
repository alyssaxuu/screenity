import {
  sendMessageTab,
  focusTab,
  removeTab,
  getCurrentTab,
} from "../tabManagement";
import { sendMessageRecord } from "./sendMessageRecord";
import {
  stopRecording,
  clearInMemoryEditorLock,
  openEarlierLocalTakeEditor,
} from "./stopRecording";
import { addAlarmListener } from "../alarms/addAlarmListener";
import { getStreamingData } from "./getStreamingData";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { diagEvent, endDiagSession } from "../../utils/diagnosticLog";
import { perfMark, perfSpan } from "../../utils/perfMarks";
import { classifyError } from "../../utils/errorCodes";
import { resetWatchdogState } from "./resetWatchdogState";
import { ATTEMPT_STATE_KEYS, isAttemptSuperseded } from "./attemptLock";
import { sweepRecorderTabs } from "./sweepRecorderTabs";
import { hasTakeFailed } from "./failedTakes";
import { emitRecordingTelemetry } from "./emitRecordingTelemetry";

// Mirrors CloudRecorder.appendUploadTelemetryEvent so BG-side projectId mutations
// land in the same `cloudUploadTelemetryEvents` storage key surfaced by
// buildDiagnosticZip → upload-telemetry.json. Diagnostic-only; best-effort.
import { appendUploadTelemetryEventSerialized } from "../utils/serializedTelemetryStore";

const appendBgUploadTelemetryEvent = async (payload) => {
  await appendUploadTelemetryEventSerialized({
    ts: Date.now(),
    uploaderType: "bg_recording",
    ...payload,
  });
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
  }

  // Falsy is ambiguous: real denial, or a rejected call from a lost gesture.
  // contains() needs no gesture, so it settles which, without re-prompting an
  // already-granted profile.
  const has = await new Promise((resolve) => {
    chrome.permissions.contains({ permissions }, (result) =>
      resolve(Boolean(result))
    );
  });

  if (has) {
    addAlarmListener();
    return { status: "ok" };
  }

  return { status: "error" };
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
  const { recordingTab, completingRecordingTab, recording, pendingRecording } =
    await chrome.storage.local.get([
      "recordingTab",
      "completingRecordingTab",
      "recording",
      "pendingRecording",
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
  // The editor sends this once its video loads, possibly well into the next take, whose offscreen flag
  // it would clear: an action click would then treat the live recording as stale and reset it.
  const updates = { completingRecordingTab: null };
  if (!recording && !pendingRecording) updates.offscreen = false;
  if (target != null && recordingTab === target) {
    updates.recordingTab = null;
  }
  chrome.storage.local.set(updates);
  console.log(
    "[Screenity][BG] handleRecordingComplete fired",
    { target, liveRecordingTab: recordingTab, cleared: target === recordingTab },
  );
};

const keepUnresolvedPendingScenes = async () => {
  let index = [];
  try {
    const raw = await chrome.storage.local.get(["pendingSceneIndex"]);
    index = Array.isArray(raw?.pendingSceneIndex) ? raw.pendingSceneIndex : [];
    if (!index.length) return [];
    const payloads = await chrome.storage.local.get(index.map((id) => `pendingScene:${id}`));
    return index.filter((id) => {
      const p = payloads?.[`pendingScene:${id}`];
      return p && p.status !== "created";
    });
  } catch {
    // Unreadable storage proves nothing resolved, so the index stays as read.
    return index;
  }
};

export const handleRecordingError = async (request) => {
  console.warn("[Screenity][handleRecordingError]", request);

  const errorCode =
    request?.errorCode ||
    classifyError(request?.why || "", request?.error || "");
  const isWarningOnly = request.error === "stream-ended";

  if (!isWarningOnly) try {
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

  await chrome.storage.local.set({ pendingRecording: false });

  endDiagSession("error");

  // mirrors discardRecording: 1+ scenes saved -> preserve project for retry
  const {
    multiMode,
    multiSceneCount,
    projectId: projectIdBeforeClear,
    sceneId: sceneIdBeforeClear,
    recordingAttemptId: attemptIdAtClear,
    uploadMeta: uploadMetaAtClear,
  } = await chrome.storage.local.get([
    "multiMode",
    "multiSceneCount",
    "projectId",
    "sceneId",
    "recordingAttemptId",
    "uploadMeta",
  ]);
  const preserveMultiProject =
    Boolean(multiMode) && Number(multiSceneCount) > 0;
  // Clear scene state when projectId clears so retries don't inherit it.
  // pendingSceneIndex must be [], not null (defaults don't fire on null).
  // Entries whose pendingScene payload still exists stay: recovery needs them.
  const keptPendingScenes = preserveMultiProject
    ? []
    : await keepUnresolvedPendingScenes();
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
        pendingSceneIndex: keptPendingScenes,
      };

  clearInMemoryEditorLock();
  await chrome.storage.local.set({
    recording: false,
    // Clear pendingRecording at stop. countdownEverShown is per-tab
    // React state, so a tab that wasn't the recorder reads stale
    // pendingRecording:true and the "Preparing…" loader sticks.
    pendingRecording: false,
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
    // Local write above never leaves the machine except in a manual zip
    // export. Send it over the network too (server allowlist has no from/to;
    // reason/errCode/errMsg carry that) into this take's own upload_sessions doc.
    const mediaIdAtClear =
      uploadMetaAtClear?.screen?.mediaId ||
      uploadMetaAtClear?.camera?.mediaId ||
      null;
    void emitRecordingTelemetry("project_state_change", {
      recordingId: mediaIdAtClear || undefined,
      mediaId: mediaIdAtClear,
      projectId: projectIdBeforeClear,
      sceneId: sceneIdBeforeClear || null,
      reason: "bg-recording-error",
      outcome: "project_cleared",
      errCode: errorCode || undefined,
      errMsg: request?.why || request?.error || undefined,
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

  sendMessageRecord({
    type: "recording-error",
    error: request?.error || null,
    why: request?.why || null,
  })
    // The recorder that reported this is usually being torn down, so the relay
    // can reject; the user must still hear about it.
    .catch((err) => {
      diagEvent("warning", {
        note: "recording-error relay undelivered",
        err: String(err).slice(0, 80),
      });
    })
    .then(() => {
      const candidateTabs = [activeTab, recordingUiTabId, tabRecordedID].filter(
        (id, idx, arr) => Number.isInteger(id) && arr.indexOf(id) === idx,
      );
      candidateTabs.forEach((id) => {
        sendMessageTab(id, {
          type: "stop-pending",
          error: request?.error || null,
          why: request?.why || null,
          errorCode,
        }).catch(() => {});
      });
      // refocus only when no editor is open
      if (!sandboxAlive) {
        focusTab(activeTab);
      }
      if (request.error === "stream-error") {
        // `why` carries the server's reason word, which is what picks the
        // lapsed-subscription copy from the never-subscribed one.
        sendMessageTab(activeTab, {
          type: "stream-error",
          errorCode,
          why: request?.why || null,
        });
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
const pushStreamingData = async (dataStr, takeId) => {
  const payload = { type: "streaming-data", data: dataStr };
  const backoffMs = [0, 300, 800];
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    if (backoffMs[attempt] > 0) {
      await new Promise((r) => setTimeout(r, backoffMs[attempt]));
    }
    if (hasTakeFailed(takeId)) {
      diagEvent("sw-streaming-data-push-dropped", { attempt, reason: "take-failed" });
      return;
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

export const handleGetStreamingData = async (message) => {
  perfMark("BG.handleGetStreamingData.enter");
  // SW-initiated pushes name no take: they are for the take started last.
  let takeId = message?.__takeId || null;
  if (!takeId) {
    try {
      ({ activeRecorderTakeId: takeId = null } = await chrome.storage.local.get([
        "activeRecorderTakeId",
      ]));
    } catch {}
  }
  if (hasTakeFailed(takeId)) {
    diagEvent("sw-streaming-data-refused", { reason: "take-failed" });
    return { ok: false, error: "take-failed" };
  }
  const data = await getStreamingData();
  // micActive decides whether a mic stream, and so a separated audio recorder,
  // exists at all; it was only observable from the offscreen document's console.
  console.warn("[Screenity][BG] streaming-data mic", {
    micActive: data?.micActive,
    defaultAudioInput: data?.defaultAudioInput || null,
    systemAudio: data?.systemAudio,
    recordingType: data?.recordingType || null,
  });
  const dataStr = JSON.stringify(data);
  // Fire-and-forget push (SW-initiated openRecorderTab path). Not awaited:
  // a `get-streaming-data` pull must get its response immediately, not
  // after the push retry loop.
  void pushStreamingData(dataStr, takeId);
  // Returned to a `get-streaming-data` pull as the direct response. This
  // is the robust delivery path; it does not depend on the recorder
  // tab's onMessage listener being registered yet, nor on `recordingTab`
  // routing being correct.
  return { ok: true, data: dataStr };
};

// A late video-ready from take N-1 must not tear down take N's state: compare the attempt
// id it carries with storage. No id on either side (free/region recorders) keeps the old behaviour.
export const isVideoReadyForEarlierTake = async (message) => {
  const messageAttemptId = message?.recordingAttemptId;
  if (!messageAttemptId) return false;
  try {
    const state = await chrome.storage.local.get(ATTEMPT_STATE_KEYS);
    return isAttemptSuperseded(state, messageAttemptId);
  } catch (err) {
    // Cannot tell, and the message names a take: leave the session alone.
    diagEvent("warning", {
      note: "video-ready attempt id unreadable, treating as earlier take",
      err: String(err).slice(0, 80),
    });
    return true;
  }
};

// Close the take that sent a video-ready, and only that one. In the host
// document it is a frame beside the newer take's; the flush lets it finish its mic.
// A free take whose Stop opened no editor gets one first, holding its bytes.
const closeEarlierTake = async (message, sender) => {
  await openEarlierLocalTakeEditor({
    localTake: message?.localTake || null,
    attemptId: message?.recordingAttemptId || null,
    takeSlot: message?.__takeSlot || null,
  });
  if (message?.__takeId) {
    await discardOffscreenDocuments({
      reason: "video-ready-earlier-take",
      onlyTakeId: message.__takeId,
    });
  } else if (sender?.documentId) {
    await discardOffscreenDocuments({
      reason: "video-ready-earlier-take",
      onlyDocumentId: sender.documentId,
    });
  }
};

export const videoReady = async (
  message,
  { earlierTake = false, sender = null } = {},
) => {
  const expectedAttemptId = message?.recordingAttemptId || null;
  perfMark("BG.recordingHelpers videoReady.enter");
  const {
    recordingDuration,
    recordingTab,
    lastRecordingBackendRef,
    recording,
  } = await chrome.storage.local.get([
    "recordingDuration",
    "recordingTab",
    "lastRecordingBackendRef",
    "recording",
  ]);
  diagEvent("sw-received-video-ready", {
    recordingDurationMs: Number(recordingDuration) || 0,
  });

  // Writer sets this fire-and-forget, but the discard path below kills that
  // context first (marker set, key nulled 11s later), so re-assert it here.
  // Skipped while recording since the file isn't finalized yet.
  if (
    lastRecordingBackendRef?.backend === "opfs" &&
    lastRecordingBackendRef?.fileName &&
    !recording
  ) {
    try {
      await chrome.storage.local.set({
        lastRecordingFinalizedFileName: lastRecordingBackendRef.fileName,
      });
    } catch {}
  }
  // The rest (tab, session, documents) now belongs to the newer take.
  if (earlierTake) {
    diagEvent("video-ready-earlier-take", {
      messageAttemptId: expectedAttemptId,
    });
    await closeEarlierTake(message, sender);
    return;
  }
  // A newer take can start during any await below, so each destructive step
  // re-checks right before it runs.
  if (await isVideoReadyForEarlierTake(message)) {
    diagEvent("video-ready-earlier-take", {
      messageAttemptId: expectedAttemptId,
      late: true,
    });
    // Its frame is done either way. Left open it stays in the host for good.
    await closeEarlierTake(message, sender);
    return;
  }
  chrome.runtime
    .sendMessage({
      type: "clear-recording-session-safe",
      reason: "video-ready-terminal",
      expectedAttemptId,
    })
    .catch((err) => {
      diagEvent("warning", { note: "clear-session-safe undelivered (video-ready)", err: String(err).slice(0, 80) });
    });
  // For OPFS the editor reads chunks directly, so the recorder tab can
  // close as soon as video-ready fires. Keeping it alive holds Chrome's
  // tab-capture binding, which makes the next getMediaStreamId reject
  // with "Cannot capture a tab with an active stream" until Chrome
  // restarts. Cloudrecorder runs its own close on finalize, so skip it.
  if (
    lastRecordingBackendRef?.backend === "opfs" &&
    recordingTab &&
    !(await isVideoReadyForEarlierTake(message))
  ) {
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
  await stopRecording({
    expectedAttemptId,
    takeId: message?.__takeId || null,
    takeSlot: message?.__takeSlot || null,
    localTake: message?.localTake || null,
  });
};
