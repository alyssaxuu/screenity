// hold extension auto-updates while recording or uploading. otherwise
// chrome applies the update at the next SW idle, the recorder tab's
// runtime context goes invalid mid-session, every chrome.* call throws
// "Extension context invalidated", and the recording is lost.
// re-check on a timer + on storage.onChanged so we reload promptly once
// the surface is idle.
import { diagEvent } from "../../utils/diagnosticLog";

const RECHECK_INTERVAL_MS = 60_000;

let pendingUpdateDetails = null;
let recheckTimer = null;
let storageListener = null;

const hasPendingUploadJournal = async () => {
  try {
    const all = await new Promise((resolve) => {
      try {
        chrome.storage.local.get(null, (s) => resolve(s || {}));
      } catch {
        resolve({});
      }
    });
    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith("uploadJournal-")) continue;
      if (!value || typeof value !== "object") continue;
      if (value.trackType === "audio") continue;
      if (value.status === "completed") continue;
      return true;
    }
  } catch {}
  return false;
};

const tryApplyUpdate = async () => {
  if (!pendingUpdateDetails) return;
  let snap = {};
  try {
    snap = await chrome.storage.local.get([
      "recording",
      "pendingRecording",
      "restarting",
      "resumeInProgress",
    ]);
  } catch {
    // storage unreachable, defer
    return;
  }
  const recordingBusy =
    Boolean(snap?.recording) ||
    Boolean(snap?.pendingRecording) ||
    Boolean(snap?.restarting) ||
    Boolean(snap?.resumeInProgress);
  if (recordingBusy) return;
  // Also defer if any non-completed upload journal exists, applying
  // the update would tear down the offscreen doc that resumes them.
  if (await hasPendingUploadJournal()) return;
  diagEvent("extension-update-applied-deferred", {
    version: pendingUpdateDetails?.version || null,
  });
  // chrome.runtime.reload() restarts the extension on the new version.
  // Open extension pages reload as a side-effect; since we've gated on
  // !recording, the recorder tab is already gone or never existed.
  try {
    chrome.runtime.reload();
  } catch (err) {
    console.warn("[Screenity][BG] runtime.reload failed", err);
  }
};

const armRecheck = () => {
  if (recheckTimer) return;
  recheckTimer = setInterval(tryApplyUpdate, RECHECK_INTERVAL_MS);
  if (!storageListener) {
    storageListener = (changes, area) => {
      if (area !== "local") return;
      // A relevant flag flipped, try immediately rather than waiting for
      // the next interval tick. Avoids a 60s stale-update window after
      // the user stops a recording.
      if (
        changes.recording ||
        changes.pendingRecording ||
        changes.restarting ||
        changes.resumeInProgress
      ) {
        tryApplyUpdate();
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
  }
};

export const onUpdateAvailableListener = () => {
  chrome.runtime.onUpdateAvailable.addListener((details) => {
    pendingUpdateDetails = details || { version: null };
    diagEvent("extension-update-available-deferred", {
      version: details?.version || null,
    });
    // Try once immediately, if nothing's recording, apply right away.
    tryApplyUpdate();
    // Otherwise, wait for the recording to finish.
    armRecheck();
  });
};
