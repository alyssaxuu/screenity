import React, { useState, useCallback, useEffect } from "react";

import localforage from "localforage";
import { activeChunksStore } from "../utils/chunkStores";
import { openExistingChunksStore } from "../CloudRecorder/recorderStorage/chooseChunksStore";
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
