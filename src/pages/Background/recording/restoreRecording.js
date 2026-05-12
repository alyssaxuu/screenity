import { sendMessageTab, getCurrentTab } from "../tabManagement";
import { chunksStore } from "./chunkHandler";

// pass explicitTabId so toasts land on the original tab even after a switch
const notifyRestoreToast = async (message, explicitTabId = null) => {
  try {
    let tabId = explicitTabId;
    if (!tabId) {
      const tab = await getCurrentTab();
      tabId = tab?.id || null;
    }
    if (!tabId) return;
    sendMessageTab(tabId, {
      type: "show-toast",
      message,
      timeout: 6000,
    }).catch(() => {});
  } catch {}
};

const notifyRestoreEmpty = (tabId = null) =>
  notifyRestoreToast(
    chrome.i18n.getMessage("restoreEmptyToast") ||
      "No recoverable recording found.",
    tabId,
  );

const notifyRestoreTimeout = (tabId = null) =>
  notifyRestoreToast(
    chrome.i18n.getMessage("restoreTimeoutToast") ||
      "Recovery is taking too long. Try opening the recovered file again.",
    tabId,
  );

const OPFS_RECORDING_PREFIX = "recording-";
// mirrors reader-side threshold; below this the editor can't open the file
const MIN_VALID_RECORDING_BYTES = 4096;

// skip tiny files so crashed-session empties don't surface
const listOpfsRecordings = async () => {
  try {
    if (!navigator.storage || typeof navigator.storage.getDirectory !== "function") {
      return [];
    }
    const dir = await navigator.storage.getDirectory();
    const files = [];
    for await (const [name, handle] of dir.entries()) {
      if (!name.startsWith(OPFS_RECORDING_PREFIX)) continue;
      if (!name.endsWith(".mp4")) continue;
      try {
        const file = await handle.getFile();
        if (file.size < MIN_VALID_RECORDING_BYTES) continue;
        files.push({ name, lastModified: file.lastModified, size: file.size });
      } catch {}
    }
    return files;
  } catch {
    return [];
  }
};

export const checkRestore = async () => {
  const [idbChunkCount, opfsFiles] = await Promise.all([
    (async () => {
      let count = 0;
      try {
        await chunksStore.iterate(() => {
          count += 1;
        });
      } catch {}
      return count;
    })(),
    listOpfsRecordings(),
  ]);
  const restore = idbChunkCount > 0 || opfsFiles.length > 0;
  return { restore };
};

export const restoreRecording = async () => {
  // capture trigger tab now; restore can take 30s+ and the user may switch
  let triggerTabId = null;
  try {
    const trigger = await getCurrentTab();
    triggerTabId = trigger?.id || null;
  } catch {}

  // WebCodecs (4.4.0+) writes here; prefer most recent
  const opfsFiles = await listOpfsRecordings();
  if (opfsFiles.length > 0) {
    opfsFiles.sort((a, b) => b.lastModified - a.lastModified);
    const latest = opfsFiles[0];
    await chrome.storage.local.set({
      lastRecordingBackendRef: {
        backend: "opfs",
        fileName: latest.name,
      },
      // orphan from a prior session, writer is gone, reader can skip polling
      lastRecordingFinalizedFileName: latest.name,
    });
    const editorUrl = "editorwebcodecs.html?mode=recover";
    chrome.tabs.create({ url: editorUrl, active: true }, async (tab) => {
      chrome.storage.local.set({ sandboxTab: tab.id });
      await new Promise((resolve) => {
        let settled = false;
        const safetyId = setTimeout(() => {
          if (settled) return;
          settled = true;
          chrome.tabs.onUpdated.removeListener(listener);
          console.warn(
            "[Screenity][BG] restore-recording (opfs) tab load timed out",
            tab.id,
          );
          notifyRestoreTimeout(triggerTabId).catch(() => {});
          setTimeout(() => {
            chrome.tabs.remove(tab.id).catch(() => {});
          }, 1000);
          resolve();
        }, 30000);
        function listener(tabId, info) {
          if (info.status === "complete" && tabId === tab.id) {
            if (settled) return;
            settled = true;
            clearTimeout(safetyId);
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(() => {
              sendMessageTab(tab.id, { type: "restore-recording" });
              resolve();
            }, 2000);
          }
        }
        chrome.tabs.onUpdated.addListener(listener);
      });
    });
    return;
  }

  // IDB fallback: MediaRecorder produces IDB chunks. WebCodecs (4.4.0+) writes
  // OPFS, which was already handled above. Routing here is purely IDB:
  // editor.html for short, editorviewer.html for long. Reading fastRecorderInUse
  // here was a stale-flag hazard — a crashed WebCodecs session can leave it
  // true while no OPFS file ever made it to disk, which would route to
  // editorwebcodecs.html and find nothing.
  const {
    recordingDuration,
    firstChunkAt,
    lastChunkAt,
  } = await chrome.storage.local.get([
    "recordingDuration",
    "firstChunkAt",
    "lastChunkAt",
  ]);
  const chunkSpanMs =
    Number(firstChunkAt) > 0 && Number(lastChunkAt) > Number(firstChunkAt)
      ? Number(lastChunkAt) - Number(firstChunkAt)
      : 0;
  const durationMs = Math.max(Number(recordingDuration) || 0, chunkSpanMs);
  const FFMPEG_MAX_DURATION_MS = 7 * 60 * 1000;

  let editorUrl, messageType;
  if (durationMs > 0 && durationMs <= FFMPEG_MAX_DURATION_MS) {
    // ffmpeg-wasm cap: editLimit:600
    editorUrl = "editor.html?mode=recover";
    messageType = "fallback-recording";
  } else {
    // ffmpeg-wasm OOMs on >7min; viewer-only
    editorUrl = "editorviewer.html?mode=recover";
    messageType = "viewer-recording";
  }

  const chunks = [];
  try {
    await chunksStore.iterate((value) => {
      chunks.push(value);
    });
  } catch (err) {
    console.warn("[Screenity][BG] restoreRecording chunksStore.iterate failed", err);
  }
  if (chunks.length === 0) {
    console.warn("[Screenity][BG] restoreRecording: no OPFS files and no IDB chunks");
    await notifyRestoreEmpty(triggerTabId);
    return;
  }
  // force IDB reader regardless of stale backendRef
  await chrome.storage.local.set({
    lastRecordingBackendRef: { backend: "idb" },
  });

  chrome.tabs.create({ url: editorUrl, active: true }, async (tab) => {
    chrome.storage.local.set({ sandboxTab: tab.id });
    await new Promise((resolve) => {
      let settled = false;
      const safetyId = setTimeout(() => {
        if (settled) return;
        settled = true;
        chrome.tabs.onUpdated.removeListener(listener);
        console.warn(
          "[Screenity][BG] restore-recording (idb) tab load timed out",
          tab.id,
        );
        notifyRestoreTimeout(triggerTabId).catch(() => {});
        setTimeout(() => {
          chrome.tabs.remove(tab.id).catch(() => {});
        }, 1000);
        resolve();
      }, 30000);
      function listener(tabId, info) {
        if (info.status === "complete" && tabId === tab.id) {
          if (settled) return;
          settled = true;
          clearTimeout(safetyId);
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => {
            sendMessageTab(tab.id, { type: messageType });
            resolve();
          }, 2000);
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
};
