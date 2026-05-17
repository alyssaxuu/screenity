import { sendMessageRecord } from "./sendMessageRecord";
import { removeTab } from "../tabManagement/removeTab";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { resetWatchdogState } from "./resetWatchdogState";

export const discardRecording = async ({
  reason = "discard",
  projectId = null,
} = {}) => {
  // Back-to-back cross-talk guard: a discard issued for a previous recording
  // must not tear down the BG state of a newer one. If this discard provably
  // targets a different project than the one currently recording, skip it.
  // Unknown projectId (legacy callers / pre-project dismiss) is honored.
  if (projectId) {
    try {
      const { projectId: currentProjectId } = await chrome.storage.local.get([
        "projectId",
      ]);
      if (currentProjectId && currentProjectId !== projectId) {
        console.warn(
          "[Screenity][BG] discardRecording skipped: project mismatch",
          { reason, target: projectId, current: currentProjectId },
        );
        return;
      }
    } catch {}
  }

  sendMessageRecord({ type: "dismiss-recording", reason, projectId });
  chrome.action.setIcon({ path: "assets/icon-34.png" });

  // await teardown before recording:false; otherwise handleAlarm fires against torn-down offscreen
  try {
    await discardOffscreenDocuments();
  } catch {}
  await resetWatchdogState();

  const { multiMode, multiSceneCount, recordingTab } =
    await chrome.storage.local.get([
      "multiMode",
      "multiSceneCount",
      "recordingTab",
    ]);

  if (recordingTab) {
    try {
      const tab = await chrome.tabs.get(recordingTab);
      if (tab?.url?.startsWith(chrome.runtime.getURL(""))) {
        removeTab(recordingTab);
      }
    } catch {}
  }

  // keep multiMode but reset project state when no scenes saved yet
  const multiState = multiMode
    ? {
        multiMode: true,
        ...(multiSceneCount > 0 ? {} : {
          multiProjectId: null,
          multiLastSceneId: null,
        }),
      }
    : {
        multiMode: false,
        multiSceneCount: 0,
        multiProjectId: null,
        multiLastSceneId: null,
      };

  chrome.storage.local.set({
    recordingTab: null,
    sandboxTab: null,
    recording: false,
    restarting: false,
    pendingRecording: false,
    offscreen: false,
    postStopEditorOpened: false,
    region: false,
    customRegion: false,
    memoryError: false,
    backup: false,
    backupSetup: false,
    backupTab: null,
    ...multiState,
  });
  chrome.storage.local.set({ pipForceClose: Date.now() });
  chrome.storage.local.set({ recordingUiTabId: null });
  chrome.storage.local.remove(["recordingMeta"]);

  chrome.runtime.sendMessage({ type: "discard-backup" });
  chrome.runtime.sendMessage({ type: "turn-off-pip" });
};

export const handleDismissRecordingTab = async (message = {}) => {
  chrome.runtime.sendMessage({ type: "discard-backup" });
  discardRecording({
    reason: message?.reason || "dismiss-recording-tab",
    projectId: message?.projectId || null,
  });
};
