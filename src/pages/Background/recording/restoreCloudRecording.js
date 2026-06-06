import { createTab, sendMessageTab } from "../tabManagement";
import { resetWatchdogState } from "./resetWatchdogState";
import { openExistingChunksStore } from "../../CloudRecorder/recorderStorage/chooseChunksStore";

const RECOVERABLE_CLOUD_STATUSES = new Set([
  "recording",
  "hidden",
  "unload",
  "stopping",
  "finalize-failed",
  "upload-stalled",
]);

// Per-track .length() against whatever backend the previous session used.
// Sessions persisted before the OPFS migration carry no storageBackends
// field, so default to IDB across all three tracks so legacy state still
// recovers.
const countChunks = async (storedSession) => {
  const backends = storedSession?.storageBackends || {
    screen: "idb",
    audio: "idb",
    camera: "idb",
  };
  const opfsSessionId =
    storedSession?.opfsSessionId || storedSession?.id || null;

  const counts = await Promise.all(
    ["screen", "camera", "audio"].map(async (track) => {
      try {
        const { store } = openExistingChunksStore({
          sessionId: opfsSessionId,
          track,
          backend: backends[track] || "idb",
        });
        return await store.length().catch(() => 0);
      } catch {
        return 0;
      }
    }),
  );
  return {
    screenCount: counts[0],
    cameraCount: counts[1],
    audioCount: counts[2],
  };
};

export const checkCloudRestore = async () => {
  try {
    const { recorderSession } = await chrome.storage.local.get([
      "recorderSession",
    ]);
    if (
      !recorderSession ||
      !RECOVERABLE_CLOUD_STATUSES.has(recorderSession.status)
    ) {
      return { cloudRestore: false };
    }

    const { screenCount, cameraCount, audioCount } = await countChunks(
      recorderSession,
    );

    return {
      cloudRestore: screenCount > 0 || cameraCount > 0 || audioCount > 0,
    };
  } catch (err) {
    console.warn("[CloudRestore] checkCloudRestore failed:", err);
    return { cloudRestore: false };
  }
};

export const restoreCloudRecording = async () => {
  const { cloudRestore } = await checkCloudRestore();
  if (!cloudRestore) return;

  await resetWatchdogState();

  const tab = await createTab("download.html", true);
  if (!tab?.id) return;

  let settled = false;
  const safetyId = setTimeout(() => {
    if (settled) return;
    settled = true;
    chrome.tabs.onUpdated.removeListener(listener);
    console.warn(
      "[Screenity][BG] cloud-restore tab load timed out",
      tab.id,
    );
  }, 30000);
  function listener(tabId, info) {
    if (info.status === "complete" && tabId === tab.id) {
      if (settled) return;
      settled = true;
      clearTimeout(safetyId);
      chrome.tabs.onUpdated.removeListener(listener);
      sendMessageTab(tab.id, { type: "recover-cloud-indexed-db" });
    }
  }
  chrome.tabs.onUpdated.addListener(listener);
};
