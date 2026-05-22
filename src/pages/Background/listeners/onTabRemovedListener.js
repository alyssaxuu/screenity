import { sendMessageTab, clearEditorTabReference } from "../tabManagement";
import { removeTab } from "../tabManagement/removeTab";
import { sendMessageRecord } from "../recording/sendMessageRecord";
import { isRecordingStartInFlight } from "../recording/startRecording";
import { diagEvent, endDiagSession } from "../../utils/diagnosticLog";

export const onTabRemovedListener = () => {
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
      const flags = await chrome.storage.local.get([
        "recording",
        "pendingRecording",
        "restarting",
        "recordingStartingAt",
        "recordingTab",
        "tabRecordedID",
        "recordingUiTabId",
        "activeTab",
        "recorderSession",
        "editorTab",
        "sandboxTab",
      ]);
      const {
        recording,
        pendingRecording,
        restarting,
        recordingTab,
        tabRecordedID,
        recordingUiTabId,
        activeTab,
        recorderSession,
        editorTab,
        sandboxTab,
      } = flags;
      // `recording` isn't true yet during start, so without this guard
      // the cleanup below tears down the recorder tab being prepared.
      const startInFlight = isRecordingStartInFlight(flags);

      if (tabId === editorTab) {
        await clearEditorTabReference("editor-tab-closed", { tabId });
      }

      // close orphaned recorder.html when editor/sandbox closes.
      // stopRecording opens as sandboxTab (not editorTab), so check both.
      const isEditorOrSandbox = tabId === editorTab || tabId === sandboxTab;
      if (isEditorOrSandbox) {
        if (tabId === sandboxTab) {
          chrome.storage.local.set({ sandboxTab: null });
        }
        const isStillRecording =
          recording ||
          (recorderSession && recorderSession.status === "recording");
        if (
          !startInFlight &&
          !isStillRecording &&
          recordingTab &&
          recordingTab !== tabId
        ) {
          try {
            const recTab = await chrome.tabs.get(recordingTab);
            const recUrl = recTab?.url || "";
            if (
              recUrl.includes("recorder.html") ||
              recUrl.includes("cloudrecorder.html")
            ) {
              removeTab(recordingTab);
            }
          } catch {}
          chrome.storage.local.set({ recordingTab: null });
        }
      }

      // tabRecordedID only; non-region tab capture handles close via stream death,
      // and recordingTab fallback would misclassify a recorder.html close.
      const recordedTabId = tabRecordedID || null;

      const isActivelyRecording =
        recording ||
        (recorderSession && recorderSession.status === "recording");
      const recorderOwnerTabId =
        recorderSession?.recorderTabId || recorderSession?.tabId || null;

      if (tabId === recorderOwnerTabId) {
        chrome.runtime
          .sendMessage({
            type: "clear-recording-session-safe",
            reason: "recorder-owner-tab-removed",
          })
          .catch(() => {});

        if (recorderSession && recorderSession.status === "recording") {
          diagEvent("crash", { reason: "recorder-owner-tab-removed", tabId });
          // Same multi-preserve guard as below; don't nuke
          // multiProjectId when the user discarded scene N (N>1) of a
          // multi-recording. The already-saved scenes' project must
          // survive so the user's "Done" click reaches it.
          const {
            multiMode: preservedMultiMode,
            multiSceneCount: preservedSceneCount,
            multiProjectId: preservedProjectId,
            multiLastSceneId: preservedLastSceneId,
          } = await chrome.storage.local.get([
            "multiMode",
            "multiSceneCount",
            "multiProjectId",
            "multiLastSceneId",
          ]);
          const hasSavedMultiScenes =
            preservedMultiMode &&
            Number(preservedSceneCount) > 0 &&
            preservedProjectId;
          await chrome.storage.local.set({
            recorderSession: {
              ...recorderSession,
              status: "crashed",
              crashedAt: Date.now(),
            },
            recording: false,
            ...(hasSavedMultiScenes
              ? {
                  multiMode: preservedMultiMode,
                  multiSceneCount: preservedSceneCount,
                  multiProjectId: preservedProjectId,
                  multiLastSceneId: preservedLastSceneId,
                }
              : {
                  multiMode: false,
                  multiSceneCount: 0,
                  multiProjectId: null,
                  multiLastSceneId: null,
                }),
          });
          endDiagSession("crashed");
        }
      }

      if (!restarting && isActivelyRecording && tabId === recordedTabId) {
        diagEvent("recorded-tab-closed");
        chrome.storage.local.set({ recordingTab: null, tabRecordedID: null });

        // direct to recorder; content script tab may not exist
        try {
          await sendMessageRecord({
            type: "stop-recording-tab",
            reason: "recorded-tab-closed",
          });
        } catch (err) {
          console.warn("Could not message recorder to stop:", err);
        }

        const { activeTab } = await chrome.storage.local.get(["activeTab"]);
        if (activeTab && activeTab !== tabId) {
          sendMessageTab(activeTab, { type: "stop-pending" }).catch(() => {});
        }

        chrome.action.setIcon({ path: "assets/icon-34.png" });
      }

      // recorder.html/cloudrecorder.html closed mid-recording; nothing else writes recording=false here
      if (
        !restarting &&
        isActivelyRecording &&
        tabId === recordingTab
      ) {
        diagEvent("crash", { reason: "recorder-tab-closed", tabId });
        endDiagSession("crashed");
        console.error("Recorder tab was closed during recording!");
        // Preserve multi-project state when scenes are already saved.
        // Without this, discarding scene N (N>1) wiped multiProjectId
        // because the cloudrecorder tab close races BG's
        // `recording:false` write and we'd see recorderSession.status
        // still "recording". The user would then click "Done" on their
        // scene 1 and hit "No project ID for multi recording".
        const {
          multiMode: preservedMultiMode,
          multiSceneCount: preservedSceneCount,
          multiProjectId: preservedProjectId,
          multiLastSceneId: preservedLastSceneId,
        } = await chrome.storage.local.get([
          "multiMode",
          "multiSceneCount",
          "multiProjectId",
          "multiLastSceneId",
        ]);
        const hasSavedMultiScenes =
          preservedMultiMode &&
          Number(preservedSceneCount) > 0 &&
          preservedProjectId;
        chrome.storage.local.set({
          recording: false,
          recordingTab: null,
          recordingUiTabId: null,
          tabRecordedID: null,
          pendingRecording: false,
          recorderSession: recorderSession
            ? { ...recorderSession, status: "crashed", crashedAt: Date.now() }
            : null,
          ...(hasSavedMultiScenes
            ? {
                multiMode: preservedMultiMode,
                multiSceneCount: preservedSceneCount,
                multiProjectId: preservedProjectId,
                multiLastSceneId: preservedLastSceneId,
              }
            : {
                multiMode: false,
                multiSceneCount: 0,
                multiProjectId: null,
                multiLastSceneId: null,
              }),
        });
        chrome.action.setIcon({ path: "assets/icon-34.png" });
      }

      if (tabId === recordingTab && !isActivelyRecording && !pendingRecording) {
        chrome.storage.local.set({ recordingTab: null });
      }

      const pendingOnly =
        pendingRecording && !isActivelyRecording && !restarting;
      if (tabId === recordingTab && pendingOnly) {
        await chrome.storage.local.set({
          pendingRecording: false,
          recording: false,
          recordingTab: null,
          tabRecordedID: null,
          recordingUiTabId: null,
        });
        chrome.action.setIcon({ path: "assets/icon-34.png" });

        const candidateTabs = [activeTab, recordingUiTabId, tabRecordedID].filter(
          (id, idx, arr) => Number.isInteger(id) && arr.indexOf(id) === idx,
        );
        candidateTabs.forEach((id) => {
          sendMessageTab(id, { type: "stop-pending" }).catch(() => {});
        });
      }
    } catch (error) {
      console.error("Error handling tab removal:", error.message);
    }
  });
};
