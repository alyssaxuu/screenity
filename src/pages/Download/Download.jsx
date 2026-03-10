import React, { useState, useCallback, useEffect } from "react";

import localforage from "localforage";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

// Get chunks store
const chunksStore = localforage.createInstance({ name: "chunks" });
const cameraChunksStore = localforage.createInstance({ name: "cameraChunks" });
const audioChunksStore = localforage.createInstance({ name: "audioChunks" });

const Download = () => {
  const base64ToUint8Array = (base64) => {
    const dataUrlRegex = /^data:(.*?);base64,/;
    const matches = base64.match(dataUrlRegex);
    if (matches !== null) {
      // Base64 is a data URL
      const mimeType = matches[1];
      const binaryString = atob(base64.slice(matches[0].length));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    } else {
      // Base64 is a regular string
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: "video/webm" });
    }
  };

  const handleMessage = useCallback((message, sender, sendResponse) => {
    if (message.type === "download-video") {
      const base64 = message.base64;
      const blob = base64ToUint8Array(base64);
      const title = message.title.replace(/[\/\\:?~<>|*"]/g, "_");
      const url = URL.createObjectURL(blob);

      chrome.downloads
        .download({
          url: url,
          filename: title,
          saveAs: true,
        })
        .then(() => {
          URL.revokeObjectURL(url);
          // Close this tab
          window.close();
        });
    } else if (message.type === "recover-indexed-db") {
      // Rewrite in localforage
      const chunkArray = [];
      chunksStore
        .iterate((value, key, iterationNumber) => {
          chunkArray.push(value.chunk);
        })
        .then(() => {
          const blob = new Blob(chunkArray, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          chrome.downloads
            .download({
              url: url,
              filename: "recovered-video.webm",
              saveAs: true,
            })
            .then(() => {
              URL.revokeObjectURL(url);
              // Close this tab
              window.close();
            });
        });
    } else if (message.type === "recover-cloud-indexed-db") {
      (async () => {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        let downloaded = 0;

        const downloadTrack = async (store, label, mimeType) => {
          const entries = [];
          await store.iterate((value) => {
            if (value?.chunk) entries.push(value);
          });
          entries.sort((a, b) => (a.index || 0) - (b.index || 0));
          if (!entries.length) return;
          const blob = new Blob(entries.map((e) => e.chunk), { type: mimeType });
          const url = URL.createObjectURL(blob);
          await chrome.downloads.download({
            url,
            filename: `Screenity-Recovery-${label}-${ts}.webm`,
            saveAs: false,
          });
          URL.revokeObjectURL(url);
          downloaded++;
        };

        await downloadTrack(chunksStore, "Screen", "video/webm");
        await downloadTrack(cameraChunksStore, "Camera", "video/webm");
        await downloadTrack(audioChunksStore, "Audio", "audio/webm");

        // Clear all three stores after download is initiated
        await Promise.allSettled([
          chunksStore.clear(),
          cameraChunksStore.clear(),
          audioChunksStore.clear(),
        ]);

        const { recorderSession } = await chrome.storage.local.get([
          "recorderSession",
        ]);

        // Remove stale TUS journal + scene keys so the next recording cannot
        // accidentally resume the crashed upload or reuse the old scene.
        // Mirrors clearStaleUploadJournals() in CloudRecorder.jsx.
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

        // Mark session as recovered so the popup button disables on next open
        if (recorderSession) {
          await chrome.storage.local.set({
            recorderSession: {
              ...recorderSession,
              status: "recovered",
              recoveredAt: Date.now(),
            },
          });
        }

        if (downloaded > 0) window.close();
      })();
    } else if (message.type === "recover-indexed-db-mp4") {
      const chunkArray = [];
      chunksStore
        .iterate((value) => {
          if (value && typeof value.index === "number" && value.chunk) {
            chunkArray.push({ index: value.index, chunk: value.chunk });
          }
        })
        .then(() => {
          chunkArray.sort((a, b) => a.index - b.index);
          const blob = new Blob(
            chunkArray.map((entry) => entry.chunk),
            { type: "video/mp4" }
          );
          const url = URL.createObjectURL(blob);
          const filename = `screenity-recording-${Date.now()}.mp4`;
          chrome.downloads
            .download({
              url: url,
              filename,
              saveAs: true,
            })
            .then(() => {
              URL.revokeObjectURL(url);
              window.close();
            });
        });
    }
  });

  useEffect(() => {
    // chrome on message
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
