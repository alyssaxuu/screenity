import { sendMessageTab, clearEditorTabReference } from "../tabManagement";
import { removeTab } from "../tabManagement/removeTab";
import { sendMessageRecord } from "../recording/sendMessageRecord";
import { diagEvent, endDiagSession } from "../../utils/diagnosticLog";

/**
 * Listener for when a tab is removed.
 * It checks if the removed tab is the active recording tab and handles cleanup if so.
 */
export const onTabRemovedListener = () => {
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
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
      } = await chrome.storage.local.get([
        "recording",
        "pendingRecording",
        "restarting",
        "recordingTab",
        "tabRecordedID",
        "recordingUiTabId",
        "activeTab",
        "recorderSession",
        "editorTab",
        "sandboxTab",
      ]);

      if (tabId === editorTab) {
        await clearEditorTabReference("editor-tab-closed", { tabId });
      }

      // Editor/sandbox tab closed — close the orphaned recorder tab (pinned
      // recorder.html) so it doesn't linger. stopRecording() opens editors as
      // sandboxTab (not editorTab), so we must check both.
      const isEditorOrSandbox = tabId === editorTab || tabId === sandboxTab;
      if (isEditorOrSandbox) {
        if (tabId === sandboxTab) {
          chrome.storage.local.set({ sandboxTab: null });
        }
        const isStillRecording =
          recording ||
          (recorderSession && recorderSession.status === "recording");
        if (!isStillRecording && recordingTab && recordingTab !== tabId) {
          try {
            const recTab = await chrome.tabs.get(recordingTab);
            const recUrl = recTab?.url || "";
            if (
              recUrl.includes("recorder.html") ||
              recUrl.includes("cloudrecorder.html")
            ) {
              removeTab(recordingTab);
            }
          } catch {
            // Tab already gone
          }
          chrome.storage.local.set({ recordingTab: null });
        }
      }

      const recordedTabId = tabRecordedID || recordingTab;

      // Check both recording flag AND recorderSession
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
          await chrome.storage.local.set({
            recorderSession: {
              ...recorderSession,
              status: "crashed",
              crashedAt: Date.now(),
            },
            recording: false,
          });
          endDiagSession("crashed");
        }
      }

      // If the removed tab is the one being recorded (for tab capture)
      if (!restarting && isActivelyRecording && tabId === recordedTabId) {
        diagEvent("recorded-tab-closed");
        // Clear reference to the removed tab
        chrome.storage.local.set({ recordingTab: null, tabRecordedID: null });

        // Send stop directly to the recorder, not through content script
        // This is more reliable as the content script tab may not exist
        try {
          await sendMessageRecord({
            type: "stop-recording-tab",
            reason: "recorded-tab-closed",
          });
        } catch (err) {
          console.warn("Could not message recorder to stop:", err);
        }

        // Also try to notify the active tab for UI cleanup
        const { activeTab } = await chrome.storage.local.get(["activeTab"]);
        if (activeTab && activeTab !== tabId) {
          sendMessageTab(activeTab, { type: "stop-pending" }).catch(() => {});
        }

        chrome.action.setIcon({ path: "assets/icon-34.png" });
      }

      // If the CloudRecorder tab itself was closed, that's a critical failure
      if (
        !restarting &&
        isActivelyRecording &&
        tabId === recordingTab &&
        recordingTab !== recordedTabId
      ) {
        diagEvent("crash", { reason: "cloud-recorder-tab-closed", tabId });
        endDiagSession("crashed");
        console.error("CloudRecorder tab was closed during recording!");
        chrome.storage.local.set({
          recording: false,
          recorderSession: recorderSession
            ? { ...recorderSession, status: "crashed", crashedAt: Date.now() }
            : null,
        });
        chrome.action.setIcon({ path: "assets/icon-34.png" });
      }

      // If the recorder tab (recorder.html) is closed after recording ends,
      // clear the stale reference so it doesn't break the next recording start.
      if (tabId === recordingTab && !isActivelyRecording && !pendingRecording) {
        chrome.storage.local.set({ recordingTab: null });
      }

      // If recorder tab is closed before recording starts, clear pending UI state.
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
