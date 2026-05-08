import { getCurrentTab } from "../tabManagement";
import { initBackup } from "../backup/initBackup";
import { startRecorderSession } from "./openRecorderTab";
import { localDirectoryStore } from "./chunkHandler";
import { perfMark } from "../../utils/perfMarks";

export const desktopCapture = async (request) => {
  perfMark("BG.desktopCapture.enter", {
    region: Boolean(request?.region),
    camera: Boolean(request?.camera),
    customRegion: Boolean(request?.customRegion),
  });
  console.log("[Screenity][desktopCapture] entered", request);
  // batched: two sequential gets added 80-160ms of storage-queue latency
  const { backup, backupSetup, onboarding } = await chrome.storage.local.get([
    "backup",
    "backupSetup",
    "onboarding",
  ]);

  // onboarding gate: prevent recorder tab opening behind the Welcome splash
  if (onboarding === true) {
    perfMark("BG.desktopCapture.blocked-by-onboarding");
    console.log(
      "[Screenity][desktopCapture] blocked: onboarding active",
    );
    return;
  }

  chrome.storage.local.set({ sendingChunks: false });

  // getCurrentTab uses lastFocusedWindow which races with editor-open focus pulls;
  // prefer the explicit sender tab id
  const initiatingTabId =
    typeof request?.initiatingTabId === "number"
      ? request.initiatingTabId
      : null;

  if (backup) {
    if (!backupSetup) {
      localDirectoryStore.clear();
    }

    let id = initiatingTabId;
    if (id == null) {
      const activeTab = await getCurrentTab();
      id = activeTab?.id ?? null;
    }
    initBackup(request, id);
  } else {
    startRecorderSession(request, initiatingTabId);
  }
};
