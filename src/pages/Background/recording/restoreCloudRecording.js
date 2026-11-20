import { createTab } from "../tabManagement";
import { resetWatchdogState } from "./resetWatchdogState";
import { listHeldTakes } from "../../Download/heldTakeList";
import { openExistingChunksStore } from "../../CloudRecorder/recorderStorage/chooseChunksStore";

// A snapshot entry is only worth a tab when something is still on disk for it.
const hasBytes = async (take, all) => {
  const snap = all[`cloudRecorderSession:${take.sessionId}`] || null;
  const opfsSessionId = snap?.opfsSessionId || take.sessionId;
  for (const t of take.tracks || []) {
    try {
      const { store } = openExistingChunksStore({
        sessionId: opfsSessionId,
        track: t.track,
        backend: t.backend || snap?.storageBackends?.[t.track] || "idb",
      });
      if ((await store.length().catch(() => 0)) > 0) return true;
    } catch {}
  }
  return false;
};

const heldTakes = async () => {
  try {
    const all = await chrome.storage.local.get(null);
    const held = [];
    for (const take of listHeldTakes(all)) {
      if (!take.fromSnapshot || (await hasBytes(take, all))) held.push(take);
    }
    return held;
  } catch {
    return [];
  }
};

export const checkCloudRestore = async () => ({
  cloudRestore: (await heldTakes()).length > 0,
});

// Recovery has one door: the held page, which offers Save and Discard for
// every take that is still on disk. Saving never clears anything.
export const restoreCloudRecording = async () => {
  if (!(await heldTakes()).length) return;
  await resetWatchdogState();
  await createTab("download.html?held=1", true);
};
