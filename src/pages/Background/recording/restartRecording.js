import { sendMessageRecord } from "./sendMessageRecord";
import { resetActiveTabRestart } from "../tabManagement/resetActiveTab";

const RESTART_ACK_TIMEOUT_MS = 7000;

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("restart-ack-timeout")), timeoutMs);
    }),
  ]);

const persistRestartFlow = async (phase, details = {}) => {
  await chrome.storage.local.set({
    lastRestartFlow: {
      phase,
      ts: Date.now(),
      ...details,
    },
  });
};

const resolveSourceTabId = (message, sender) =>
  message?.sourceTabId || sender?.tab?.id || null;

export const handleRestart = async (message = {}, sender = null) => {
  const sourceTabId = resolveSourceTabId(message, sender);
  await chrome.storage.local.set({
    restarting: true,
    ...(sourceTabId != null
      ? { activeTab: sourceTabId, recordingUiTabId: sourceTabId }
      : {}),
  });
  await persistRestartFlow("requested", { sourceTabId });

  try {
    const response = await withTimeout(
      sendMessageRecord({
        type: "restart-recording-tab",
        sourceTabId,
      }),
      RESTART_ACK_TIMEOUT_MS,
    );

    if (!response?.ok || response?.restarted !== true) {
      throw new Error(response?.error || "restart-ack-failed");
    }

    await persistRestartFlow("ack", {
      sourceTabId,
      restarted: Boolean(response?.restarted),
    });
    await resetActiveTabRestart({ sourceTabId });
    await persistRestartFlow("countdown-dispatched", { sourceTabId });
    return { ok: true, restarted: true };
  } catch (error) {
    const reason = error?.message || String(error);
    await chrome.storage.local.set({ restarting: false });
    await persistRestartFlow("failed", { sourceTabId, reason });
    return { ok: false, error: reason };
  }
};

export const handleRestartRecordingTab = async (message, sender) =>
  handleRestart(message, sender);
