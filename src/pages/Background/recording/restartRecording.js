import { sendMessageRecord } from "./sendMessageRecord";
import { resetActiveTabRestart } from "../tabManagement/resetActiveTab";
import { diagEvent } from "../../utils/diagnosticLog";
import { lifecycle } from "../../utils/lifecycleLog";
import { resetWatchdogState } from "./resetWatchdogState";

const RESTART_ACK_TIMEOUT_MS = 7000;
const RESTART_HISTORY_MAX = 20;

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("restart-ack-timeout")), timeoutMs);
    }),
  ]);

const persistRestartFlow = async (phase, details = {}) => {
  const entry = { phase, ts: Date.now(), ...details };
  try {
    const { restartFlowHistory } = await chrome.storage.local.get([
      "restartFlowHistory",
    ]);
    const history = Array.isArray(restartFlowHistory) ? restartFlowHistory : [];
    history.push(entry);
    while (history.length > RESTART_HISTORY_MAX) history.shift();
    await chrome.storage.local.set({
      lastRestartFlow: entry,
      restartFlowHistory: history,
    });
  } catch {}
};

const resolveSourceTabId = (message, sender) =>
  message?.sourceTabId || sender?.tab?.id || null;

export const handleRestart = async (message = {}, sender = null) => {
  const sourceTabId = resolveSourceTabId(message, sender);
  const attemptId = `restart-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  let preflight = {};
  try {
    preflight = await chrome.storage.local.get([
      "recordingTab",
      "recording",
      "pendingRecording",
      "offscreen",
      "recorderSession",
    ]);
  } catch {}
  const preflightSummary = {
    recordingTab: preflight.recordingTab ?? null,
    recording: Boolean(preflight.recording),
    pendingRecording: Boolean(preflight.pendingRecording),
    offscreen: Boolean(preflight.offscreen),
    recorderSessionTab:
      preflight.recorderSession?.recorderTabId ||
      preflight.recorderSession?.tabId ||
      null,
  };

  // reset before round-trip so a mid-flight alarm can't fire tier-3 against stale keys
  await resetWatchdogState();
  await chrome.storage.local.set({
    restarting: true,
    ...(sourceTabId != null
      ? { activeTab: sourceTabId, recordingUiTabId: sourceTabId }
      : {}),
  });
  await persistRestartFlow("requested", {
    attemptId,
    sourceTabId,
    preflight: preflightSummary,
  });
  lifecycle("BG.restart", "requested", {
    attemptId,
    sourceTabId,
    ...preflightSummary,
  });
  diagEvent("restart-requested", { attemptId, sourceTabId });

  try {
    const response = await withTimeout(
      sendMessageRecord({
        type: "restart-recording-tab",
        sourceTabId,
        attemptId,
      }),
      RESTART_ACK_TIMEOUT_MS,
    );

    lifecycle("BG.restart", "ack-received", {
      attemptId,
      ok: Boolean(response?.ok),
      restarted: Boolean(response?.restarted),
      error: response?.error || null,
      recorderState: response?.recorderState || null,
    });

    if (!response?.ok || response?.restarted !== true) {
      const err = new Error(response?.error || "restart-ack-failed");
      err._recorderState = response?.recorderState || null;
      err._stage = "ack-rejected";
      throw err;
    }

    await persistRestartFlow("ack", {
      attemptId,
      sourceTabId,
      restarted: Boolean(response?.restarted),
      recorderState: response?.recorderState || null,
    });
    await resetActiveTabRestart({ sourceTabId });
    await persistRestartFlow("countdown-dispatched", { attemptId, sourceTabId });
    lifecycle("BG.restart", "completed", { attemptId, sourceTabId });
    diagEvent("restart-completed", { attemptId });
    return { ok: true, restarted: true };
  } catch (error) {
    const reason = error?.message || String(error);
    const stage =
      error?._stage ||
      (reason.includes("Receiving end does not exist") ||
      reason.includes("No tab with id") ||
      reason.includes("No recording tab available")
        ? "send-no-tab"
        : reason.includes("restart-ack-timeout")
          ? "ack-timeout"
          : "send-error");
    await chrome.storage.local.set({ restarting: false });
    await persistRestartFlow("failed", {
      attemptId,
      sourceTabId,
      stage,
      reason,
      recorderState: error?._recorderState || null,
    });
    lifecycle("BG.restart", "failed", {
      attemptId,
      sourceTabId,
      stage,
      reason,
      recorderState: error?._recorderState || null,
    });
    diagEvent("restart-failed", { attemptId, stage, reason });
    // Content caller is fire-and-forget; toast the user directly
    try {
      const targetTabId =
        sourceTabId ||
        (await chrome.storage.local.get(["activeTab"])).activeTab ||
        null;
      if (Number.isInteger(targetTabId)) {
        chrome.tabs
          .sendMessage(targetTabId, {
            type: "show-toast",
            message: chrome.i18n.getMessage("restartFailedToast"),
            timeout: 6000,
          })
          .catch(() => {});
      }
    } catch {}
    return { ok: false, error: reason, stage };
  }
};

export const handleRestartRecordingTab = async (message, sender) =>
  handleRestart(message, sender);
