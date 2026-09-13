import React, { useState, useCallback, useEffect } from "react";

import localforage from "localforage";
import { activeChunksStore } from "../utils/chunkStores";
import { openExistingChunksStore } from "../CloudRecorder/recorderStorage/chooseChunksStore";
import { destroySessionDir } from "../CloudRecorder/recorderStorage/opfsKvStore";
import {
  MP4_CONTAINER,
  containerFromMime,
  containerFromFileName,
} from "../utils/downloadContainer";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

// Legacy recover-indexed-db-mp4 path, outside CloudRecorder's per-session
// backend choice. Always the newest recording, so it follows the live slot.
const chunksStore = activeChunksStore;
const cameraChunksStore = localforage.createInstance({ name: "cameraChunks" });
const audioChunksStore = localforage.createInstance({ name: "audioChunks" });

const Download = () => {
  const base64ToUint8Array = (base64) => {
    const dataUrlRegex = /^data:(.*?);base64,/;
    const matches = base64.match(dataUrlRegex);
    if (matches !== null) {
      const mimeType = matches[1];
      const binaryString = atob(base64.slice(matches[0].length));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    } else {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: "video/webm" });
    }
  };

  // Mirror Sandbox/ContentState's sanitizeDownloadFilename. Covers C0/C1
  // controls (chrome.downloads rejects), trailing dots/spaces (Windows
  // reserves), empty result, and MAX_PATH length cap.
  const sanitizeFilename = (raw) => {
    let out = String(raw ?? "");
    out = out.replace(/[\/\\:?~<>|*"]/g, "_");
    out = out.replace(/[\x00-\x1f\x7f]/g, "_");
    out = out.replace(/\s+/g, " ").trim();
    out = out.replace(/[. ]+$/g, "");
    if (!out) out = "Screenity recording";
    if (out.length > 200) out = out.slice(0, 200).trim();
    return out;
  };

  const handleMessage = useCallback((message, sender, sendResponse) => {
    if (message.type === "download-video") {
      const base64 = message.base64;
      const blob = base64ToUint8Array(base64);
      const title = sanitizeFilename(message.title);
      const url = URL.createObjectURL(blob);

      chrome.downloads
        .download({
          url: url,
          filename: title,
          saveAs: true,
        })
        .then(() => {
          URL.revokeObjectURL(url);
          window.close();
        });
    } else if (message.type === "recover-cloud-indexed-db") {
      (async () => {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        let downloaded = 0;
        let recoveryFailed = false;
        // Revoke blob URLs only after every download has been queued.
        const urlsToRevoke = [];

        // Pick the right backend per track — sessions written before the
        // OPFS migration default to IDB across the board.
        const { recorderSession: prefetchedSession } =
          await chrome.storage.local.get(["recorderSession"]);
        const backends = prefetchedSession?.storageBackends || {
          screen: "idb",
          audio: "idb",
          camera: "idb",
        };
        const opfsSessionId =
          prefetchedSession?.opfsSessionId || prefetchedSession?.id || null;
        const usedOpfs = Object.values(backends).some((b) => b === "opfs");

        const screenStore = openExistingChunksStore({
          sessionId: opfsSessionId,
          track: "screen",
          backend: backends.screen || "idb",
        }).store;
        const cameraStore = openExistingChunksStore({
          sessionId: opfsSessionId,
          track: "camera",
          backend: backends.camera || "idb",
        }).store;
        const audioStore = openExistingChunksStore({
          sessionId: opfsSessionId,
          track: "audio",
          backend: backends.audio || "idb",
        }).store;

        // Per-track container drives the recovery-file extension. Sessions
        // recorded under WebCodecs put screen+camera in fragmented MP4;
        // older / fallback sessions stay on WebM. Audio is mp4 or webm.
        const containers = prefetchedSession?.trackContainers || {
          screen: "video/webm",
          camera: "video/webm",
          audio: "video/webm",
        };
        const containerToExt = (c) =>
          c === "video/mp4" ? "mp4" : "webm";
        const screenExt = containerToExt(containers.screen);
        const cameraExt = containerToExt(containers.camera);
        const audioIsMp4 = containers.audio === "audio/mp4";
        const audioExt = audioIsMp4 ? "m4a" : "webm";

        // Clear only tracks that actually downloaded — without this a
        // failing track keeps ALL chunks, so retry re-downloads the
        // successful ones too.
        const successfulStores = [];
        const downloadTrack = async (store, label, mimeType, ext) => {
          const entries = [];
          await store.iterate((value) => {
            if (value?.chunk) entries.push(value);
          });
          entries.sort((a, b) => (a.index || 0) - (b.index || 0));
          if (!entries.length) {
            successfulStores.push(store);
            return;
          }
          try {
            const blob = new Blob(entries.map((e) => e.chunk), { type: mimeType });
            const url = URL.createObjectURL(blob);
            urlsToRevoke.push(url);
            await chrome.downloads.download({
              url,
              filename: `Screenity-Recovery-${label}-${ts}.${ext}`,
              saveAs: false,
            });
            downloaded++;
            successfulStores.push(store);
          } catch (err) {
            recoveryFailed = true;
            console.error(`[CloudRestore] ${label} track download failed`, err);
          }
        };

        await downloadTrack(
          screenStore,
          "Screen",
          containers.screen || "video/webm",
          screenExt,
        );
        await downloadTrack(
          cameraStore,
          "Camera",
          containers.camera || "video/webm",
          cameraExt,
        );
        await downloadTrack(
          audioStore,
          "Audio",
          audioIsMp4 ? "audio/mp4" : "audio/webm",
          audioExt,
        );

        // Let the download manager fetch the blob URLs first.
        await new Promise((r) => setTimeout(r, 2000));
        for (const u of urlsToRevoke) {
          try {
            URL.revokeObjectURL(u);
          } catch {}
        }

        // Failed tracks remain so the user can retry recovery for them.
        await Promise.allSettled(
          successfulStores.map((s) => s.clear())
        );

        // If anything was on OPFS, drop the session directory once all
        // tracks downloaded successfully; failed tracks leave their files
        // behind for retry, and the startup orphan sweep reaps them
        // eventually.
        if (
          usedOpfs &&
          opfsSessionId &&
          successfulStores.length === 3 &&
          !recoveryFailed
        ) {
          destroySessionDir(opfsSessionId).catch(() => {});
        }

        const { recorderSession } = await chrome.storage.local.get([
          "recorderSession",
        ]);

        // Remove stale TUS journal + scene keys so the next recording can't
        // resume the crashed upload or reuse the old scene.
        const journalKeysToRemove = ["sceneId", "sceneIdStatus"];
        const tracks = recorderSession?.tracks || {};
        for (const trackData of Object.values(tracks)) {
          const upl = trackData?.uploader;
          if (!upl) continue;
          if (upl.journalKey) journalKeysToRemove.push(upl.journalKey);
          if (upl.journalLookupKey)
            journalKeysToRemove.push(upl.journalLookupKey);
          const pid = upl.projectId || recorderSession?.projectId || null;
          const sid = upl.sceneId || null;
          const t = upl.type || upl.trackType || null;
          if (pid && t) {
            journalKeysToRemove.push(
              `bunnyVideoMap-${pid}-${sid || "none"}-${t || "none"}`,
            );
          }
        }
        try {
          await chrome.storage.local.remove([...new Set(journalKeysToRemove)]);
        } catch (err) {
          console.warn("[CloudRestore] failed to remove stale journal keys", err);
        }

        if (recorderSession && !recoveryFailed) {
          await chrome.storage.local.set({
            recorderSession: {
              ...recorderSession,
              status: "recovered",
              recoveredAt: Date.now(),
            },
          });
        }

        if (downloaded > 0 && !recoveryFailed) window.close();
      })();
    } else if (message.type === "recover-indexed-db-mp4") {
      // Bytes can live in OPFS (WebCodecs path) or IDB (legacy MR fast-mp4).
      // Before this branch, the IDB-only iterate produced a 0-byte file when
      // the source was OPFS — the "Download anyway" button on the hard-fail
      // modal silently failed.
      (async () => {
        let blob = null;
        let container = MP4_CONTAINER;
        try {
          const { lastRecordingBackendRef } = await chrome.storage.local.get([
            "lastRecordingBackendRef",
          ]);
          if (
            lastRecordingBackendRef?.backend === "opfs" &&
            lastRecordingBackendRef?.fileName
          ) {
            try {
              const dir = await navigator.storage.getDirectory();
              const handle = await dir.getFileHandle(
                lastRecordingBackendRef.fileName,
              );
              const file = await handle.getFile();
              if (file && file.size > 0) {
                container = containerFromFileName(
                  lastRecordingBackendRef.fileName,
                  MP4_CONTAINER,
                );
                blob = new Blob([file], { type: container.mime });
              }
            } catch (err) {
              console.warn(
                "[Screenity][Download] OPFS read failed, falling back to IDB",
                err,
              );
            }
          }
          if (!blob) {
            const chunkArray = [];
            await chunksStore.iterate((value) => {
              if (value && typeof value.index === "number" && value.chunk) {
                chunkArray.push({ index: value.index, chunk: value.chunk });
              }
            });
            chunkArray.sort((a, b) => a.index - b.index);
            if (chunkArray.length > 0) {
              container = containerFromMime(
                chunkArray[0]?.chunk?.type,
                MP4_CONTAINER,
              );
              blob = new Blob(
                chunkArray.map((entry) => entry.chunk),
                { type: container.mime },
              );
            }
          }
        } catch (err) {
          console.error("[Screenity][Download] recovery failed", err);
        }
        if (!blob || blob.size === 0) {
          console.warn("[Screenity][Download] no bytes available to download");
          window.close();
          return;
        }
        const url = URL.createObjectURL(blob);
        const filename = `screenity-recording-${Date.now()}.${container.ext}`;
        try {
          await chrome.downloads.download({
            url,
            filename,
            saveAs: true,
          });
        } finally {
          URL.revokeObjectURL(url);
          window.close();
        }
      })();
    }
  });

  useEffect(() => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message);
    });

    return () => {
      chrome.runtime.onMessage.removeListener(
        (message, sender, sendResponse) => {
          handleMessage(message);
        }
      );
    };
  }, []);

  return <div></div>;
};

export default Download;
