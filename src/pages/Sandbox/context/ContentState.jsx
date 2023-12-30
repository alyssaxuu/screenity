import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { useEffect } from "react";

import fixWebmDuration from "fix-webm-duration";

export const ContentStateContext = createContext();

const ContentState = (props) => {
  const videoChunks = useRef([]);

  const defaultState = {
    time: 0,
    editLimit: 300,
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

  /*
  function base64ToUint8Array(base64) {
    const dataURLRegex = /^data:.+;base64,/;
    if (dataURLRegex.test(base64)) {
      base64 = base64.replace(dataURLRegex, "");
    }

    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }

    return bytes;
  }
	*/

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
    };
    video.src = URL.createObjectURL(contentState.blob);
  }, [contentState.blob]);

  const reconstructVideo = async () => {
    const blob = new Blob(videoChunks.current, {
      type: "video/webm; codecs=vp9",
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

    fixWebmDuration(
      blob,
      recordingDuration,
      async (fixedWebm) => {
        const reader = new FileReader();
        reader.readAsDataURL(fixedWebm);
        reader.onloadend = function () {
          const base64data = reader.result;
          // Postmessage to parent (this is an iframe)
          setContentState((prevContentState) => ({
            ...prevContentState,
            base64: base64data,
            driveEnabled: driveEnabled,
          }));
        };
      },
      { logger: false }
    );
  };

  const onChromeMessage = useCallback((request, sender, sendResponse) => {
    const message = request;

    if (message.type === "new-chunk-tab") {
      // Chunkdata is base64 encoded, needs to be a blob
      const chunkData = base64ToUint8Array(message.chunk);
      videoChunks.current.push(chunkData);
      chrome.runtime.sendMessage({ type: "request-next-chunk" });
    } else if (message.type === "make-video-tab") {
      // All chunks received, reconstruct video
      reconstructVideo();
      sendResponse({ status: "ok" });
    } else if (message.type === "saved-to-drive") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        saveDrive: false,
        driveEnabled: true,
        saved: true,
      }));
    }
  });

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
    const webmVideo = new Blob([base64ToUint8Array(contentState.base64)], {
      type: "video/webm",
    });

    setContentState((prevState) => ({
      ...prevState,
      webm: webmVideo,
      ready: true,
    }));

    if (contentState.offline && contentState.ffmpeg === true) {
      console.log("Offline");
    } else if (!contentState.updateChrome) {
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
    if (contentState.duration > contentState.editLimit) return;

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
    if (contentState.duration > contentState.editLimit) return;

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
    if (contentState.duration > contentState.editLimit) return;

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
    if (contentState.duration > contentState.editLimit) return;

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

    chrome.downloads.download({
      url: url,
      filename: title,
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
