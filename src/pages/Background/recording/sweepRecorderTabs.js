import { removeTab } from "../tabManagement/removeTab";
import { diagEvent } from "../../utils/diagnosticLog";

// Stop and remove every free recorder tab, optionally sparing one.
//
// The single `recordingTab` storage slot can only ever name one recorder
// tab. When a second one is spawned (countdown-finished racing the
// countdownFallback) or the slot is overwritten by the next attempt, the
// earlier recorder tab becomes both unreachable and unkillable: nothing
// holds its id. Its MediaRecorder then runs until the tab is closed by
// hand. This enumerates recorder tabs by URL so none can hide behind a
// lost handle.
//
// Scope: `recorder.html` only. The Pro `cloudrecorder.html` tab has its
// own lifecycle (recorderSession tracking, self-close on TUS finalize,
// multi-scene handoff) and must not be swept here.
export const sweepRecorderTabs = async ({ exceptTabId = null } = {}) => {
  const removed = [];
  try {
    const recorderUrl = chrome.runtime.getURL("recorder.html");
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id == null || tab.id === exceptTabId) continue;
      const url = tab.url || tab.pendingUrl || "";
      if (!url.startsWith(recorderUrl)) continue;
      try {
        await removeTab(tab.id);
        removed.push(tab.id);
      } catch {}
    }
  } catch (err) {
    console.warn("[Screenity] sweepRecorderTabs failed", err);
  }
  if (removed.length) {
    diagEvent("recorder-tabs-swept", { removed, exceptTabId });
  }
  return removed;
};
