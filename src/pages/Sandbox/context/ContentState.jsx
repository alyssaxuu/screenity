import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { useEffect } from "react";

import fixWebmDuration from "fix-webm-duration";
import { default as fixWebmDurationFallback } from "webm-duration-fix";

import localforage from "localforage";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity", // global DB group
  version: 1,
});

const chunksStore = localforage.createInstance({
  name: "chunks", // the actual DB name
  storeName: "keyvaluepairs",
});

export const ContentStateContext = createContext();

const ContentState = (props) => {
  const videoChunks = useRef([]);
  const makeVideoCheck = useRef(false);
  const chunkCount = useRef(0);

  const defaultState = {
    time: 0,
    editLimit: 420,
    blob: null,
    webm: null,
    originalBlob: null,
    updatePlayerTime: false,
    start: 0, // Add missing properties here
    end: 1,
    trimming: false,
    cutting: false,
    muting: false,
    history: [{}], // Initialize history with a default state
    redoHistory: [],
    undoDisabled: true,
    redoDisabled: true,
    duration: 0,
    mode: "player",
    ffmpegLoaded: false,
    frame: null,
    getFrame: null,
    isFfmpegRunning: false,
    reencoding: false,
    prevWidth: 0,
    width: 0,
    prevHeight: 0,
    height: 0,
    top: 0,
    left: 0,
    fromCropper: false,
    base64: null,
    saveDrive: false,
    downloading: false,
    downloadingWEBM: false,
    downloadingGIF: false,
    volume: 1,
    cropPreset: "none",
    replaceAudio: false,
    title: null,
    ready: false,
    mp4ready: false,
    saved: false,
    iframeRef: null,
    offline: false,
    updateChrome: false,
    driveEnabled: false,
    hasBeenEdited: false,
    dragInteracted: false,
    noffmpeg: false,
    processingProgress: 0, // Progress percentage (0-100) for current operation
    openModal: null,
    rawBlob: null,
    override: false,
    fallback: false,
    chunkCount: 0,
    chunkIndex: 0,
    bannerSupport: false,
    backupBlob: null,
  };

  const [contentState, setContentState] = useState(defaultState);
  const contentStateRef = useRef(contentState);

  const buildBlobFromChunks = async () => {
    const items = [];

    await chunksStore.ready();

    await chunksStore.iterate((value) => (items.push(value), undefined));

    items.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    const parts = items.map((c) =>
      c.chunk instanceof Blob ? c.chunk : new Blob([c.chunk])
    );

    const first = parts[0];
    const inferredType = first?.type || "video/webm";

    const blob = new Blob(parts, { type: inferredType });

    reconstructVideo(blob);
  };

  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);

  // Check if the user is offline
  // useEffect(() => {
  //   if (!navigator.onLine) {
  //     setContentState((prevState) => ({
  //       ...prevState,
  //       offline: true,
  //     }));
  //   }
  // }, []);

  // Generate a title based on the current time (e.g. Screenity video - Sep 4 2021 10:00 AM)
  useEffect(() => {
    const date = new Date();
    const formattedDate = date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    setContentState((prevState) => ({
      ...prevState,
      title: `Screenity video - ${formattedDate}`,
    }));
  }, []);

  // Show a popup when attempting to close the tab if the user has not downloaded their video
  useEffect(() => {
    if (!contentState.saved) {
      window.onbeforeunload = function () {
        return true;
      };
    } else {
      window.onbeforeunload = null;
    }
  }, [contentState.saved]);

  const createBackup = () => {
    setContentState((prev) => ({
      ...prev,
      backupBlob: prev.blob,
    }));
  };

  const restoreBackup = () => {
    setContentState((prev) => ({
      ...prev,
      blob: prev.backupBlob || prev.blob,
      mode: "player",
      start: 0,
      end: 1,
      backupBlob: null,
    }));
  };

  const clearBackup = () => {
    setContentState((prev) => ({
      ...prev,
      backupBlob: null,
    }));
  };

  const addToHistory = useCallback(() => {
    setContentState((prevState) => ({
      ...prevState,
      history: [...prevState.history, prevState],
      redoHistory: [], // Clear redo history when a new state is added
    }));
  }, [contentState]);

  const undo = useCallback(() => {
    if (contentState.history.length > 1) {
      const previousState =
        contentState.history[contentState.history.length - 2];
      const newHistory = contentState.history.slice(0, -1);
      setContentState((prevState) => ({
        ...prevState,
        ...previousState,
        history: newHistory,
        redoHistory: [contentState, ...contentState.redoHistory],
      }));
    }
  }, [contentState]);

  const redo = useCallback(() => {
    if (contentState.redoHistory.length > 0) {
      const nextState = contentState.redoHistory[0];
      const newRedoHistory = contentState.redoHistory.slice(1);
      setContentState((prevState) => ({
        ...prevState,
        ...nextState,
        history: [...contentState.history, contentState],
        redoHistory: newRedoHistory,
      }));
    }
  }, [contentState]);

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
      return bytes;
    }
  };

  useEffect(() => {
    if (!contentState.blob) return;

    // Get duration of video blob
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = async () => {
      setContentState((prevState) => ({
        ...prevState,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        prevWidth: video.videoWidth,
        prevHeight: video.videoHeight,
      }));

      URL.revokeObjectURL(video.src);
      video.remove();
    };
    video.src = URL.createObjectURL(contentState.blob);
  }, [contentState.blob]);

  const reconstructVideo = async (withBlob) => {
    let blob = withBlob
      ? withBlob
      : new Blob(videoChunks.current, { type: "video/webm; codecs=vp8,opus" });

    if (blob.type === "video/mp4" || /\.mp4$/i.test(blob.name || "")) {
      setContentState((prev) => ({
        ...prev,
        blob: blob,
        webm: null,
        mp4ready: true,
        ready: true,
        rawBlob: blob,
        isFfmpegRunning: false,
        noffmpeg: false,
      }));

      // Extract duration, width, height
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        setContentState((prev) => ({
          ...prev,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        }));

        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(blob);

      chrome.runtime.sendMessage({ type: "recording-complete" });
      return;
    }

    const { recordingDuration } = await chrome.storage.local.get(
      "recordingDuration"
    );

    // Check if token is present
    const { token } = await chrome.storage.local.get("token");

    let driveEnabled = false;

    if (token && token !== null) {
      driveEnabled = true;
    }

    setContentState((prevState) => ({
      ...prevState,
      rawBlob: blob,
      duration: recordingDuration / 1000,
    }));

    // Check if user is in Windows 10
    const isWindows10 = navigator.userAgent.match(/Windows NT 10.0/);

    try {
      if (recordingDuration > 0 && recordingDuration !== null) {
        if (!isWindows10) {
          fixWebmDuration(
            blob,
            recordingDuration,
            async (fixedWebm) => {
              // Skip conversion only if Chrome is outdated or recording exceeds edit limit
              if (
                contentStateRef.current.updateChrome ||
                contentStateRef.current.noffmpeg ||
                (contentStateRef.current.duration >
                  contentStateRef.current.editLimit &&
                  !contentStateRef.current.override)
              ) {
                setContentState((prevState) => ({
                  ...prevState,
                  webm: fixedWebm,
                  ready: true,
                }));
                chrome.runtime.sendMessage({ type: "recording-complete" });
                return;
              }

              const reader = new FileReader();
              reader.onloadend = function () {
                const base64data = reader.result;
                setContentState((prevContentState) => ({
                  ...prevContentState,
                  base64: base64data,
                  driveEnabled: driveEnabled,
                }));
              };
              reader.readAsDataURL(fixedWebm);
            },
            { logger: false }
          );
        } else {
          const fixedWebm = await fixWebmDurationFallback(blob, {
            type: "video/webm; codecs=vp8, opus",
          });

          // Skip conversion only if Chrome is outdated or recording exceeds edit limit
          if (
            contentStateRef.current.updateChrome ||
            contentStateRef.current.noffmpeg ||
            (contentStateRef.current.duration >
              contentStateRef.current.editLimit &&
              !contentStateRef.current.override)
          ) {
            setContentState((prevState) => ({
              ...prevState,
              webm: fixedWebm,
              ready: true,
            }));
            chrome.runtime.sendMessage({ type: "recording-complete" });
            return;
          }

          const reader = new FileReader();
          reader.onloadend = function () {
            const base64data = reader.result;
            setContentState((prevContentState) => ({
              ...prevContentState,
              base64: base64data,
              driveEnabled: driveEnabled,
            }));
          };
          reader.readAsDataURL(fixedWebm);
        }
      } else {
        /// Skip fixing duration
        // Skip conversion only if Chrome is outdated or recording exceeds edit limit
        if (
          contentStateRef.current.updateChrome ||
          contentStateRef.current.noffmpeg ||
          (contentStateRef.current.duration >
            contentStateRef.current.editLimit &&
            !contentStateRef.current.override)
        ) {
          setContentState((prevState) => ({
            ...prevState,
            webm: blob,
            ready: true,
          }));
          chrome.runtime.sendMessage({ type: "recording-complete" });
          return;
        }

        const reader = new FileReader();
        reader.onloadend = function () {
          const base64data = reader.result;
          setContentState((prevContentState) => ({
            ...prevContentState,
            base64: base64data,
            driveEnabled: driveEnabled,
          }));
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      setContentState((prevState) => ({
        ...prevState,
        webm: blob,
        ready: true,
      }));
      chrome.runtime.sendMessage({ type: "recording-complete" });
    }
  };

  const checkMemory = () => {
    if (typeof contentStateRef.current.openModal === "function") {
      chrome.storage.local.get("memoryError", (result) => {
        if (result.memoryError && result.memoryError !== null) {
          chrome.storage.local.set({ memoryError: false });
          contentStateRef.current.openModal(
            chrome.i18n.getMessage("memoryLimitTitle"),
            chrome.i18n.getMessage("memoryLimitDescription"),
            chrome.i18n.getMessage("understoodButton"),
            null,
            () => {},
            () => {},
            null,
            chrome.i18n.getMessage("learnMoreDot"),
            () => {
              chrome.runtime.sendMessage({ type: "memory-limit-help" });
            }
          );
        }
      });
    }
  };

  useEffect(() => {
    chunkCount.current = contentState.chunkCount;
  }, [contentState.chunkCount]);

  const handleBatch = (chunks, sendResponse) => {
    // Process chunks asynchronously, but do not make this function async
    (async () => {
      try {
        await Promise.all(
          chunks.map(async (chunk) => {
            if (contentStateRef.current.chunkIndex >= chunkCount.current) {
              return; // Skip processing
            }

            const chunkData = base64ToUint8Array(chunk.chunk);
            videoChunks.current.push(chunkData);

            // Assuming setContentState doesn't need to be awaited
            setContentState((prevState) => ({
              ...prevState,
              chunkIndex: prevState.chunkIndex + 1,
            }));
          })
        );

        sendResponse({ status: "ok" });
      } catch (error) {
        console.error("Error processing batch", error);
      }
    })();

    return true; // Keep the messaging channel open for the response
  };

  // Check Chrome version
  useEffect(() => {
    const version = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);

    const MIN_CHROME_VERSION = 109;

    if (version && parseInt(version[2], 10) < MIN_CHROME_VERSION) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        updateChrome: true,
        noffmpeg: true,
      }));
    }
  }, []);

  const makeVideoTab = (sendResponse = null, message) => {
    if (makeVideoCheck.current) return;
    makeVideoCheck.current = true;
    setContentState((prevState) => ({
      ...prevState,
      override: message.override,
    }));
    // All chunks received, reconstruct video
    checkMemory();
    reconstructVideo();
    if (sendResponse !== null) {
      sendResponse({ status: "ok" });
    }
  };

  const toBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
    });
  };

  const onChromeMessage = useCallback(
    (request, sender, sendResponse) => {
      const message = request;
      if (message.type === "chunk-count") {
        setContentState((prevState) => ({
          ...prevState,
          chunkCount: message.count,
          override: message.override,
        }));
      } else if (message.type === "ping") {
        sendResponse({ status: "ready" });
      } else if (message.type === "new-chunk-tab") {
        return handleBatch(message.chunks, sendResponse);
      } else if (message.type === "make-video-tab") {
        makeVideoTab(sendResponse, message);

        return true;
      } else if (message.type === "saved-to-drive") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          saveDrive: false,
          driveEnabled: true,
          saved: true,
        }));
      } else if (message.type === "restore-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          fallback: true,
          noffmpeg: false, // Pretending FFmpeg is loaded (using Mediabunny)
          isFfmpegRunning: false,
          editLimit: 3600, // Set high edit limit (1 hour) for recovery mode
        }));

        buildBlobFromChunks()
          .then(() => {
            sendResponse({ status: "ok" });
          })
          .catch((error) => {
            sendResponse({ status: "error", error: error.message });
          });

        return true; // Keep message port open for async response
      } else if (message.type === "large-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          noffmpeg: false,
          isFfmpegRunning: false,
          editLimit: 0,
        }));

        buildBlobFromChunks()
          .then(() => {
            sendResponse({ status: "ok" });
          })
          .catch((error) => {
            sendResponse({ status: "error", error: error.message });
          });

        return true; // Keep message port open for async response
      } else if (message.type === "fallback-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          fallback: true,
          noffmpeg: false,
          isFfmpegRunning: false,
          editLimit: 3600,
        }));

        buildBlobFromChunks()
          .then(() => {
            sendResponse({ status: "ok" });
          })
          .catch((error) => {
            sendResponse({ status: "error", error: error.message });
          });

        return true;
      } else if (message.type === "viewer-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          fallback: true,
          noffmpeg: true, // No FFmpeg
          isFfmpegRunning: false,
          editLimit: 0, // No editing allowed
        }));

        buildBlobFromChunks()
          .then(() => {
            sendResponse({ status: "ok" });
          })
          .catch((error) => {
            sendResponse({ status: "error", error: error.message });
          });

        return true;
      } else if (message.type === "banner-support") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          bannerSupport: true,
        }));
      }
    },
    [
      makeVideoCheck.current,
      videoChunks.current,
      contentState,
      contentStateRef.current,
    ]
  );

  useEffect(() => {
    const messageListener = (message, sender, sendResponse) => {
      const shouldKeepPortOpen = onChromeMessage(message, sender, sendResponse);
      return shouldKeepPortOpen === true;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const onMessage = async (event) => {
    if (event.data.type === "updated-blob") {
      const base64 = event.data.base64;
      // const blob = new Blob([base64ToUint8Array(base64)], {
      //   type: "video/mp4",
      // });
      const blob = base64ToUint8Array(base64);

      const wasCropping = contentState.cropping;
      const isTopLevel = event.data.topLevel === true;
      const isFromAudio = event.data.fromAudio === true;

      if (isFromAudio) {
        sendMessage({
          type: "reencode-video",
          blob,
          duration: contentState.duration,
          topLevel: isTopLevel,
        });
        return;
      }

      setContentState((prev) => ({
        ...prev,
        blob: blob,
        mp4ready: true,
        hasBeenEdited: true,
        isFfmpegRunning: false,
        reencoding: false,
        trimming: false,
        cutting: false,
        muting: false,
        cropping: false,
        processingProgress: 0,
        hasTempChanges: !isTopLevel,

        ...(prev.fromCropper && { mode: "player", fromCropper: false }),
        ...(prev.fromAudio && { mode: "player", fromAudio: false }),
      }));

      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = async () => {
        setContentState((prev) => ({
          ...prev,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          start: 0,
          end: 1,
          ...(wasCropping && { top: 0, left: 0 }),
        }));

        if (event.data.addToHistory) {
          contentState.addToHistory();
        }

        URL.revokeObjectURL(video.src);
        video.remove();
      };

      video.src = URL.createObjectURL(blob);

      if (!contentState.originalBlob && isTopLevel) {
        setContentState((prev) => ({
          ...prev,
          originalBlob: blob,
        }));
      }
    } else if (event.data.type === "download-mp4") {
      const base64 = event.data.base64;
      // const blob = new Blob([base64ToUint8Array(base64)], {
      //   type: "video/mp4",
      // });
      const blob = base64ToUint8Array(base64);
      // Download the blob
      const url = URL.createObjectURL(blob);
      requestDownload(url, ".mp4");
      setContentState((prevContentState) => ({
        ...prevContentState,
        saved: true,
        isFfmpegRunning: false,
        downloading: false,
      }));
    } else if (event.data.type === "download-gif") {
      const base64 = event.data.base64;
      // const blob = new Blob([base64ToUint8Array(base64)], {
      //   type: "image/gif",
      // });
      const blob = base64ToUint8Array(base64);
      // Download the blob
      const url = URL.createObjectURL(blob);
      requestDownload(url, ".gif");
      setContentState((prevContentState) => ({
        ...prevContentState,
        saved: true,
        isFfmpegRunning: false,
        downloadingGIF: false,
      }));
    } else if (event.data.type === "new-frame") {
      const url = URL.createObjectURL(event.data.frame);
      setContentState((prevContentState) => ({
        ...prevContentState,
        frame: url,
        isFfmpegRunning: false,
      }));
    } else if (event.data.type === "ffmpeg-loaded") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        ffmpeg: true,
        ffmpegLoaded: true,
        isFfmpegRunning: false,
      }));
    } else if (event.data.type === "ffmpeg-load-error") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        ffmpeg: true,
        noffmpeg: true,
        ffmpegLoaded: true,
        isFfmpegRunning: false,
      }));

      // if (!navigator.onLine) {
      //   setContentState((prevState) => ({
      //     ...prevState,
      //     offline: true,
      //   }));

      //   // Try loading ffmpeg again when reconnected to the internet
      //   window.addEventListener("online", () => {
      //     setContentState((prevState) => ({
      //       ...prevState,
      //       offline: false,
      //     }));
      //     contentState.loadFFmpeg();
      //   });
      // }
    } else if (event.data.type === "crop-update") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        mode: "crop",
        cropping: false,
        isFfmpegRunning: false,
        processingProgress: 0,
        start: 0,
        end: 1,
        fromCropper: false,
      }));

      setTimeout(() => {
        if (contentState.getFrame) {
          contentState.getFrame();
        }
      }, 100);
    } else if (event.data.type === "ffmpeg-progress") {
      const pct = Math.min(100, Math.max(0, Math.round(event.data.progress)));

      setContentState((prevContentState) => ({
        ...prevContentState,
        processingProgress: pct,
      }));
    } else if (event.data.type === "download-webm") {
      const base64 = event.data.base64;
      // const blob = new Blob([base64ToUint8Array(base64)], {
      //   type: "video/webm",
      // });
      const blob = base64ToUint8Array(base64);

      const url = URL.createObjectURL(blob);
      await requestDownload(url, ".webm");

      setContentState((prevState) => ({
        ...prevState,
        saved: true,
        isFfmpegRunning: false,
        downloadingWEBM: false,
      }));
    }
  };

  // Listen to PostMessage events
  useEffect(() => {
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onMessage]);

  const sendMessage = (message) => {
    window.parent.postMessage(message, "*");
  };

  const getBlob = async () => {
    // Skip conversion only if Chrome is outdated or recording exceeds edit limit
    if (
      contentState.noffmpeg ||
      (contentState.duration > contentState.editLimit && !contentState.override)
    ) {
      return;
    }

    // const webmVideo = new Blob([base64ToUint8Array(contentState.base64)], {
    //   type: "video/webm",
    // });

    const webmVideo = base64ToUint8Array(contentState.base64);

    setContentState((prevState) => ({
      ...prevState,
      webm: webmVideo,
      ready: true,
    }));

    if (contentState.offline && contentState.ffmpeg === true) {
      // Offline (if I need to do anything differently)
    } else if (
      !contentState.updateChrome &&
      (contentState.duration <= contentState.editLimit || contentState.override)
    ) {
      // Set isFfmpegRunning to true when starting conversion
      setContentState((prevState) => ({
        ...prevState,
        isFfmpegRunning: true,
      }));
      sendMessage({
        type: "base64-to-blob",
        base64: contentState.base64,
        topLevel: true,
      });
    }

    chrome.runtime.sendMessage({ type: "recording-complete" });
  };

  useEffect(() => {
    if (!contentState.base64) return;
    if (!contentState.ffmpeg) return;
    if (!contentState.ffmpegLoaded) return;

    getBlob();
  }, [contentState.base64, contentState.ffmpeg, contentState.ffmpegLoaded]);

  const getImage = useCallback(async () => {
    if (!contentState.blob) return;
    if (!contentState.ffmpeg) return;
    if (contentState.isFfmpegRunning) return;

    setContentState((prevState) => ({
      ...prevState,
      isFfmpegRunning: true, // Set isFfmpegRunning to true to indicate that ffmpeg is running
    }));

    sendMessage({ type: "get-frame", time: 0, blob: contentState.blob });
  }, [contentState.blob, contentState.ffmpeg, contentState.isFfmpegRunning]);

  const addAudio = async (videoBlob, audioBlob, volume) => {
    if (contentState.isFfmpegRunning) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    const sourceBlob = videoBlob || contentState.blob || contentState.webm;

    setContentState((prev) => ({
      ...prev,
      isFfmpegRunning: true,
      processingProgress: 0,
    }));

    sendMessage({
      type: "add-audio-to-video",
      blob: sourceBlob,
      audio: audioBlob,
      duration: contentState.duration,
      volume: volume,
      replaceAudio: contentState.replaceAudio,
      topLevel: false,
    });
  };

  const handleTrim = async (cut) => {
    if (contentState.isFfmpegRunning) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    const sourceBlob = contentState.blob;

    setContentState((prev) => ({
      ...prev,
      isFfmpegRunning: true,
      processingProgress: 0,
      [cut ? "cutting" : "trimming"]: true,
    }));

    sendMessage({
      type: "cut-video",
      blob: sourceBlob,
      startTime: contentState.start * contentState.duration,
      endTime: contentState.end * contentState.duration,
      cut,
      duration: contentState.duration,
      encode: false,
      topLevel: false,
    });
  };

  const handleMute = async () => {
    if (contentState.isFfmpegRunning) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    const sourceBlob = contentState.blob;

    setContentState((prev) => ({
      ...prev,
      muting: true,
      isFfmpegRunning: true,
      processingProgress: 0,
    }));

    sendMessage({
      type: "mute-video",
      blob: sourceBlob,
      startTime: contentState.start * contentState.duration,
      endTime: contentState.end * contentState.duration,
      duration: contentState.duration,
      topLevel: false,
    });
  };

  const handleCrop = async (x, y, width, height) => {
    if (contentState.isFfmpegRunning || contentState.cropping) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    setContentState((prevState) => ({
      ...prevState,
      cropping: true,
      isFfmpegRunning: true,
      processingProgress: 0,
    }));

    const sourceBlob = contentState.blob;

    sendMessage({
      type: "crop-video",
      blob: sourceBlob,
      x,
      y,
      width,
      height,
      topLevel: false,
    });

    return true;
  };

  const handleReencode = async (topLevel = false) => {
    if (contentState.isFfmpegRunning) return;

    const sourceBlob = contentState.blob;

    setContentState((prevState) => ({
      ...prevState,
      isFfmpegRunning: true,
      reencoding: true,
      processingProgress: 0, // Reset progress
    }));

    sendMessage({
      type: "reencode-video",
      blob: sourceBlob,
      duration: contentState.duration,
      topLevel,
    });

    return true;
  };

  const requestDownload = async (url, ext) => {
    const title =
      contentStateRef.current.title.replace(/[\/\\:?~<>|*]/g, " ").trim() + ext;

    const revoke = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    };

    // Brave fallback: send base64 to background for download
    if ((navigator.brave && (await navigator.brave.isBrave())) || false) {
      const resp = await fetch(url);
      const blob = await resp.blob();
      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          chrome.runtime.sendMessage({
            type: "request-download",
            base64: reader.result,
            title,
          });
          revoke();
          resolve();
        };
        reader.readAsDataURL(blob);
      });
      return;
    }

    // Normal Chrome download – capture the id so we only react to this download
    const downloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download(
        { url, filename: title, saveAs: true },
        (id) => {
          if (chrome.runtime.lastError || !id) {
            reject(chrome.runtime.lastError || new Error("Download failed"));
          } else {
            resolve(id);
          }
        }
      );
    });

    await new Promise((resolve) => {
      const handler = async (delta) => {
        if (delta.id !== downloadId || !delta.state) return;

        const done = () => {
          chrome.downloads.onChanged.removeListener(handler);
          revoke();
          resolve();
        };

        // If download got interrupted (but not canceled by user), fallback to base64 route
        if (
          delta.state.current === "interrupted" &&
          delta.error?.current !== "USER_CANCELED"
        ) {
          try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            await new Promise((res) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                chrome.runtime.sendMessage({
                  type: "request-download",
                  base64: reader.result,
                  title,
                });
                res();
              };
              reader.readAsDataURL(blob);
            });
          } finally {
            done();
          }
        } else if (
          delta.state.current === "complete" ||
          delta.state.current === "interrupted"
        ) {
          // complete or user canceled
          done();
        }
      };

      chrome.downloads.onChanged.addListener(handler);
    });
  };

  const download = async () => {
    if (contentState.isFfmpegRunning || contentState.downloading) {
      return;
    }

    setContentState((prevState) => ({
      ...prevState,
      downloading: true,
      isFfmpegRunning: true,
    }));

    const url = URL.createObjectURL(contentState.blob);
    requestDownload(url, ".mp4");

    setContentState((prevState) => ({
      ...prevState,
      downloading: false,
      isFfmpegRunning: false,
      saved: true,
    }));
  };

  const downloadWEBM = async () => {
    if (contentState.isFfmpegRunning || contentState.downloadingWEBM) return;

    const sourceBlob = contentState.blob || contentState.webm;

    if (!sourceBlob) {
      return;
    }

    const hasFFmpeg = contentState.ffmpegLoaded && !contentState.noffmpeg;
    const isAlreadyWebm = sourceBlob.type === "video/webm";

    if (!hasFFmpeg || isAlreadyWebm) {
      const url = URL.createObjectURL(sourceBlob);
      await requestDownload(url, ".webm");

      setContentState((prevState) => ({
        ...prevState,
        downloadingWEBM: false,
        isFfmpegRunning: false,
        saved: true,
      }));
      return;
    }

    setContentState((prevState) => ({
      ...prevState,
      downloadingWEBM: true,
      isFfmpegRunning: true,
      processingProgress: 0,
    }));

    sendMessage({
      type: "to-webm",
      blob: sourceBlob,
      duration: contentState.duration,
    });

    await waitForUpdatedBlob();

    setContentState((prevState) => ({
      ...prevState,
      downloadingWEBM: false,
      isFfmpegRunning: false,
      saved: true,
    }));
  };

  const downloadGIF = async () => {
    if (contentState.isFfmpegRunning || contentState.downloading) {
      return;
    }
    if (contentState.duration > 30) return;

    setContentState((prevState) => ({
      ...prevState,
      downloadingGIF: true,
      isFfmpegRunning: true,
    }));

    sendMessage({
      type: "to-gif",
      blob: contentState.blob,
    });
  };

  const loadFFmpeg = async () => {
    sendMessage({ type: "load-ffmpeg" });
  };

  const waitForUpdatedBlob = () => {
    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.data?.type === "updated-blob") {
          window.removeEventListener("message", handler);
          resolve();
        }
      };
      window.addEventListener("message", handler);
    });
  };

  contentState.undo = undo;
  contentState.redo = redo;
  contentState.addToHistory = addToHistory;
  contentState.handleTrim = handleTrim;
  contentState.handleMute = handleMute;
  contentState.download = download;
  contentState.handleCrop = handleCrop;
  contentState.handleReencode = handleReencode;
  contentState.getFrame = getImage;
  contentState.downloadGIF = downloadGIF;
  contentState.downloadWEBM = downloadWEBM;
  contentState.addAudio = addAudio;
  contentState.loadFFmpeg = loadFFmpeg;
  contentState.waitForUpdatedBlob = waitForUpdatedBlob;
  contentState.createBackup = createBackup;
  contentState.restoreBackup = restoreBackup;
  contentState.clearBackup = clearBackup;

  return (
    <ContentStateContext.Provider value={[contentState, setContentState]}>
      {props.children}
    </ContentStateContext.Provider>
  );
};

export default ContentState;
