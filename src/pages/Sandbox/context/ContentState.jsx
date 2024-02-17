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
    openModal: null,
    rawBlob: null,
    override: false,
    fallback: false,
    chunkCount: 0,
    chunkIndex: 0,
  };

  const [contentState, setContentState] = useState(defaultState);
  const contentStateRef = useRef(contentState);

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

  const reconstructVideo = async () => {
    const blob = new Blob(videoChunks.current, {
      type: "video/webm; codecs=vp8, opus",
    });

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
              if (
                contentStateRef.current.fallback ||
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

          if (
            contentStateRef.current.fallback ||
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
        if (
          contentStateRef.current.fallback ||
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

  const handleBatch = async (chunks, sendResponse) => {
    // Process chunks with a promise to ensure all async operations are completed
    await Promise.all(
      chunks.map(async (chunk) => {
        if (contentStateRef.current.chunkIndex >= chunkCount.current) {
          console.warn("Too many chunks received");
          // Handling for too many chunks
          return Promise.resolve(); // Resolve early for this case
        }

        const chunkData = base64ToUint8Array(chunk.chunk);
        videoChunks.current.push(chunkData);

        // Assuming setContentState doesn't need to be awaited
        setContentState((prevState) => ({
          ...prevState,
          chunkIndex: prevState.chunkIndex + 1,
        }));

        return Promise.resolve(); // Resolve after processing each chunk
      })
    )
      .then(() => {
        // Only send response after all chunks are processed
        sendResponse({ status: "ok" });
      })
      .catch((error) => {
        console.error("Error processing batch", error);
        // Handle error scenario, possibly notify sender of failure
      });

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

  const onChromeMessage = useCallback(
    (request, sender, sendResponse) => {
      const message = request;
      if (message.type === "chunk-count") {
        setContentState((prevState) => ({
          ...prevState,
          chunkCount: message.count,
          override: message.override,
        }));
      } else if (message.type === "new-chunk-tab") {
        return handleBatch(message.chunks, sendResponse);
      } else if (message.type === "make-video-tab") {
        makeVideoTab(sendResponse, message);

        return;
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
          isFfmpegRunning: false,
          noffmpeg: true,
          ffmpegLoaded: true,
          ffmpeg: true,
        }));
      } else if (message.type === "fallback-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          fallback: true,
          isFfmpegRunning: false,
          noffmpeg: true,
          ffmpegLoaded: true,
          ffmpeg: true,
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
    chrome.runtime.onMessage.addListener(onChromeMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(onChromeMessage);
    };
  }, []);

  const onMessage = async (event) => {
    if (event.data.type === "updated-blob") {
      const base64 = event.data.base64;
      const blob = new Blob([base64ToUint8Array(base64)], {
        type: "video/mp4",
      });

      setContentState((prevContentState) => ({
        ...prevContentState,
        blob: blob,
        mp4ready: true,
        hasBeenEdited: true,
        isFfmpegRunning: false,
        reencoding: false,
        trimming: false,
        cutting: false,
        muting: false,
        cropping: false,
      }));

      // Get duration of video blob
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = async () => {
        setContentState((prevState) => ({
          ...prevState,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          start: 0,
          end: 1,
        }));

        if (event.data.addToHistory) {
          contentState.addToHistory();
        }

        URL.revokeObjectURL(video.src);
        video.remove();
      };
      video.src = URL.createObjectURL(blob);

      // Check if originalBlob is null, if so, set it to the blob
      if (!contentState.originalBlob) {
        setContentState((prevContentState) => ({
          ...prevContentState,
          originalBlob: blob,
        }));
      }
    } else if (event.data.type === "download-mp4") {
      const base64 = event.data.base64;
      const blob = new Blob([base64ToUint8Array(base64)], {
        type: "video/mp4",
      });
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
      const blob = new Blob([base64ToUint8Array(base64)], {
        type: "image/gif",
      });
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
        mode: "player",
        start: 0,
        end: 1,
      }));
    }
  };

  // Listen to PostMessage events
  useEffect(() => {
    window.addEventListener("message", (event) => {
      onMessage(event);
    });

    return () => {
      window.removeEventListener("message", (event) => {
        onMessage(event);
      });
    };
  }, []);

  const sendMessage = (message) => {
    window.parent.postMessage(message, "*");
  };

  const getBlob = async () => {
    if (
      contentState.fallback ||
      contentState.noffmpeg ||
      (contentState.duration > contentState.editLimit && !contentState.override)
    )
      return;
    const webmVideo = new Blob([base64ToUint8Array(contentState.base64)], {
      type: "video/webm",
    });

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
      sendMessage({ type: "base64-to-blob", base64: contentState.base64 });
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

    setContentState((prevState) => ({
      ...prevState,
      isFfmpegRunning: true,
    }));

    sendMessage({
      type: "add-audio-to-video",
      blob: videoBlob,
      audio: audioBlob,
      duration: contentState.duration,
      volume: volume,
      replaceAudio: contentState.replaceAudio,
    });
  };

  const handleTrim = async (cut) => {
    if (contentState.isFfmpegRunning) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    if (cut) {
      setContentState((prevState) => ({
        ...prevState,
        cutting: true,
      }));
    } else {
      setContentState((prevState) => ({
        ...prevState,
        trimming: true,
      }));
    }

    setContentState((prevState) => ({
      ...prevState,
      isFfmpegRunning: true,
    }));

    sendMessage({
      type: "cut-video",
      blob: contentState.blob,
      startTime: contentState.start * contentState.duration,
      endTime: contentState.end * contentState.duration,
      cut: cut,
      duration: contentState.duration,
      encode: false,
    });
  };

  const handleMute = async () => {
    if (contentState.isFfmpegRunning || contentState.muting) {
      return;
    }
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    setContentState((prevState) => ({
      ...prevState,
      muting: true,
      isFfmpegRunning: true,
    }));

    sendMessage({
      type: "mute-video",
      blob: contentState.blob,
      startTime: contentState.start * contentState.duration,
      endTime: contentState.end * contentState.duration,
      duration: contentState.duration,
    });
  };

  const handleCrop = async (x, y, width, height) => {
    if (contentState.isFfmpegRunning || contentState.cropping) {
      return;
    }
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    setContentState((prevState) => ({
      ...prevState,
      cropping: true,
      isFfmpegRunning: true,
    }));

    sendMessage({
      type: "crop-video",
      blob: contentState.blob,
      x: x,
      y: y,
      width: width,
      height: height,
    });

    return true;
  };

  const handleReencode = async () => {
    if (contentState.isFfmpegRunning) return;

    setContentState((prevState) => ({
      ...prevState,
      isFfmpegRunning: true,
      reencoding: true,
    }));

    sendMessage({
      type: "reencode-video",
      blob: contentState.blob,
      duration: contentState.duration,
    });

    return true;
  };

  const requestDownload = async (url, type) => {
    const ext = type;
    // The title must not have these characters  " : ? ~ < > * |
    // Replace them with a space
    const title =
      contentStateRef.current.title.replace(/[:?~<>|*]/g, " ") + ext;

    // Check if user is on Brave browser
    if ((navigator.brave && (await navigator.brave.isBrave())) || false) {
      // Convert URL to base64
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = function () {
        chrome.runtime.sendMessage({
          type: "request-download",
          base64: reader.result,
          title: title,
        });
        URL.revokeObjectURL(url);
        return;
      };
    } else {
      chrome.downloads.download({
        url: url,
        filename: title,
        saveAs: true,
      });

      // Check if download failed
      chrome.downloads.onChanged.addListener(async (downloadDelta) => {
        if (
          downloadDelta.state &&
          downloadDelta.state.current === "interrupted" &&
          downloadDelta.error.current != "USER_CANCELED"
        ) {
          // Convert URL to base64
          const response = await fetch(url);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = function () {
            chrome.runtime.sendMessage({
              type: "request-download",
              base64: reader.result,
              title: title,
            });
          };
          URL.revokeObjectURL(url);
          return;
        } else {
          URL.revokeObjectURL(url);
          return;
        }
      });
    }
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
    if (contentState.isFfmpegRunning || contentState.downloadingWEBM) {
      return;
    }

    setContentState((prevState) => ({
      ...prevState,
      downloadingWEBM: true,
      isFfmpegRunning: true,
    }));

    const url = URL.createObjectURL(contentState.webm);
    requestDownload(url, ".webm");

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

  // Include all functions in the context
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

  return (
    <ContentStateContext.Provider value={[contentState, setContentState]}>
      {props.children}
    </ContentStateContext.Provider>
  );
};

export default ContentState;
