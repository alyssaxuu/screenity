import localforage from "localforage";
import { createTab, sendMessageTab } from "../tabManagement";

const RECOVERABLE_CLOUD_STATUSES = new Set([
  "recording",
  "hidden",
  "unload",
  "stopping",
  "finalize-failed",
  "upload-stalled",
]);

// Mirror the store names CloudRecorder.jsx uses. createInstance({ name }) sets
// the IndexedDB database name directly, so these reach the same databases
// regardless of any global localforage.config() call.
const cloudScreenStore = localforage.createInstance({ name: "chunks" });
const cloudCameraStore = localforage.createInstance({ name: "cameraChunks" });
const cloudAudioStore = localforage.createInstance({ name: "audioChunks" });

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

    const [screenCount, cameraCount, audioCount] = await Promise.all([
      cloudScreenStore.length().catch(() => 0),
      cloudCameraStore.length().catch(() => 0),
      cloudAudioStore.length().catch(() => 0),
    ]);

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

  const tab = await createTab("download.html", true, true);
  if (!tab?.id) return;

  chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (info.status === "complete" && tabId === tab.id) {
      chrome.tabs.onUpdated.removeListener(listener);
      sendMessageTab(tab.id, { type: "recover-cloud-indexed-db" });
    }
  });
};
