import React, { useEffect, useState, useRef, useCallback } from "react";
import localforage from "localforage";
import RecorderUI from "./RecorderUI";
import { createMediaRecorder } from "./mediaRecorderUtils";
import { sendRecordingError, sendStopRecording } from "./messaging";
import { getBitrates, getResolutionForQuality } from "./recorderConfig";

import { WebCodecsRecorder } from "./webcodecs/WebCodecsRecorder";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

// Get chunks store
const chunksStore = localforage.createInstance({
  name: "chunks",
});

document.body.style.willChange = "contents";

const Recorder = () => {
  const isRestarting = useRef(false);
  const isFinishing = useRef(false);
  const sentLast = useRef(false);
  const lastTimecode = useRef(0);
  const hasChunks = useRef(false);

  const lastSize = useRef(0);
  const index = useRef(0);

  const [started, setStarted] = useState(false);

  // Main stream (recording)
  const liveStream = useRef(null);

  // Helper streams
  const helperVideoStream = useRef(null);
  const helperAudioStream = useRef(null);

  // Audio controls, with refs to persist across renders
  const aCtx = useRef(null);
  const destination = useRef(null);
  const audioInputSource = useRef(null);
  const audioOutputSource = useRef(null);
  const audioInputGain = useRef(null);
  const audioOutputGain = useRef(null);

  const recorder = useRef(null);
  const useWebCodecs = useRef(false);

  const isTab = useRef(false);
  const tabID = useRef(null);
  const tabPreferred = useRef(false);

  const backupRef = useRef(false);

  const pending = useRef([]);
  const draining = useRef(false);
  const lowStorageAbort = useRef(false);
  const savedCount = useRef(0);

  const lastEstimateAt = useRef(0);
  const ESTIMATE_INTERVAL_MS = 5000;
  const MIN_HEADROOM = 25 * 1024 * 1024;
  const MAX_PENDING_BYTES = 8 * 1024 * 1024;
  const pendingBytes = useRef(0);

  async function canFitChunk(byteLength) {
    const now = performance.now();
    if (now - lastEstimateAt.current < ESTIMATE_INTERVAL_MS) {
      return !lowStorageAbort.current;
    }
    lastEstimateAt.current = now;

    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const remaining = quota - usage;
      return remaining > MIN_HEADROOM + (byteLength || 0);
    } catch {
      return !lowStorageAbort.current;
    }
  }

  async function saveChunk(e, i) {
    const ts = e.timecode ?? 0;

    // FLAG: disabled duplicate chunk check due to issues with some devices
    // if (
    //   savedCount.current > 0 &&
    //   ts === lastTimecode.current &&
    //   e.data.size === lastSize.current
    // ) {
    //   return false;
    // }

    if (!(await canFitChunk(e.data.size))) {
      lowStorageAbort.current = true;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
      });
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });
      return false;
    }

    try {
      await chunksStore.setItem(`chunk_${i}`, {
        index: i,
        chunk: e.data,
        timestamp: ts,
      });
    } catch (err) {
      lowStorageAbort.current = true;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
      });
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });
      return false;
    }

    lastTimecode.current = ts;
    lastSize.current = e.data.size;
    savedCount.current += 1;

    if (backupRef.current) {
      chrome.runtime.sendMessage({ type: "write-file", index: i });
    }
    return true;
  }

  async function drainQueue() {
    if (draining.current) return;
    draining.current = true;

    try {
      while (pending.current.length) {
        if (lowStorageAbort.current) {
          pending.current.length = 0;
          pendingBytes.current = 0;
          break;
        }

        const e = pending.current.shift();
        pendingBytes.current -= e.data.size;

        if (!(await canFitChunk(e.data.size))) {
          lowStorageAbort.current = true;
          chrome.storage.local.set({
            recording: false,
            restarting: false,
            tabRecordedID: null,
            memoryError: true,
          });
          chrome.runtime.sendMessage({ type: "stop-recording-tab" });
          pending.current.length = 0;
          pendingBytes.current = 0;
          break;
        }

        const i = index.current;
        const saved = await saveChunk(e, i);
        if (saved) index.current = i + 1;
      }
    } finally {
      draining.current = false;
    }
  }

  async function waitForDrain() {
    while (draining.current || pending.current.length) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  useEffect(() => {
    chrome.storage.local.get(["backup"], (result) => {
      if (result.backup) {
        backupRef.current = true;
      } else {
        backupRef.current = false;
      }
    });
  }, []);

  async function startRecording() {
    // Check that a recording is not already in progress
    if (recorder.current !== null) return;

    navigator.storage.persist();
    if (
      !helperVideoStream.current ||
      helperVideoStream.current.getVideoTracks().length === 0
    ) {
      sendRecordingError("No video tracks available");
      return;
    }

    await chunksStore.clear();

    lastTimecode.current = 0;
    lastSize.current = 0;
    hasChunks.current = false;
    savedCount.current = 0;
    pending.current = [];
    draining.current = false;
    lowStorageAbort.current = false;
    pendingBytes.current = 0;
    sentLast.current = false;
    isFinishing.current = false;

    const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);
    const { audioBitsPerSecond, videoBitsPerSecond } =
      getBitrates(qualityValue);

    // Decide if we can use WebCodecs
    const canUseWebCodecs =
      typeof VideoEncoder !== "undefined" &&
      typeof AudioEncoder !== "undefined" &&
      typeof MediaStreamTrackProcessor !== "undefined";

    // Get basic video info
    const videoTrack = liveStream.current?.getVideoTracks()[0] ?? null;
    const settings = videoTrack?.getSettings() || {};
    const width = settings.width ?? 1920;
    const height = settings.height ?? 1080;

    // fps from storage
    const { fpsValue } = await chrome.storage.local.get(["fpsValue"]);
    let fps = parseInt(fpsValue);
    if (Number.isNaN(fps)) fps = 30;

    chrome.storage.local.set({
      recording: true,
      restarting: false,
    });

    isRestarting.current = false;
    index.current = 0;

    // Common "onChunk" handler that uses your existing queue + drain logic
    // Common "onChunk" handler
    const handleChunk = async (data, timestampMs) => {
      // 🔹 WebCodecs path: save directly, no queue, no canFitChunk
      if (useWebCodecs.current) {
        const blob =
          data instanceof Blob ? data : new Blob([data], { type: "video/mp4" });

        const ts = timestampMs ?? 0;
        const i = index.current;

        console.log(
          "[RECORDER] WebCodecs handleChunk → index",
          i,
          "size",
          blob.size,
          "ts",
          ts
        );

        try {
          await chunksStore.setItem(`chunk_${i}`, {
            index: i,
            chunk: blob,
            timestamp: ts,
          });
          console.log("[RECORDER] WebCodecs saved chunk_", i);
          index.current = i + 1;
          hasChunks.current = true;
          savedCount.current += 1;

          if (backupRef.current) {
            chrome.runtime.sendMessage({ type: "write-file", index: i });
          }
        } catch (err) {
          console.error("[RECORDER] WebCodecs saveChunk error", err);
        }

        return;
      }

      // 🔹 MediaRecorder path (unchanged)
      if (lowStorageAbort.current) return;

      const blob =
        data instanceof Blob ? data : new Blob([data], { type: "video/mp4" });

      const e = {
        data: blob,
        timecode: timestampMs ?? 0,
      };

      if (!hasChunks.current) {
        hasChunks.current = true;
        lastTimecode.current = e.timecode;
        lastSize.current = e.data.size;
      }

      pending.current.push(e);
      pendingBytes.current += e.data.size;

      if (pendingBytes.current > MAX_PENDING_BYTES) {
        try {
          if (
            recorder.current instanceof MediaRecorder &&
            recorder.current.state !== "paused"
          ) {
            recorder.current.pause();
          }
          await drainQueue();
          if (
            recorder.current instanceof MediaRecorder &&
            recorder.current.state === "paused"
          ) {
            recorder.current.resume();
          }
        } catch {
          await drainQueue();
        }
      }

      void drainQueue();
    };

    try {
      if (canUseWebCodecs) {
        // ✅ Use WebCodecs backend
        useWebCodecs.current = true;

        recorder.current = new WebCodecsRecorder(liveStream.current, {
          width,
          height,
          fps,
          videoBitrate: videoBitsPerSecond,
          audioBitrate: audioBitsPerSecond,
          onFinalized: async () => {
            console.log("[RECORDER] WebCodecs finalize event → assembling MP4");
            await assembleAndDownload(); // ⭐ only downloaded here
          },
          onChunk: (chunkData, timestampUs) => {
            // chunkData = Uint8Array from muxer
            const blob = new Blob([chunkData], { type: "video/mp4" });

            // Convert microseconds → ms (what the rest of your code expects)
            const timestampMs = timestampUs
              ? Math.floor(timestampUs / 1000)
              : 0;

            handleChunk(blob, timestampMs);
          },
          onError: (err) => {
            console.error("[WebCodecsRecorder] error", err);
            sendRecordingError(String(err));
          },
          onStop: async () => {
            await waitForDrain();
            if (!sentLast.current) {
              sentLast.current = true;
              isFinishing.current = false;
              chrome.runtime.sendMessage({ type: "video-ready" });
            }
          },
        });

        await recorder.current.start();
      } else {
        // 🔁 Fallback to MediaRecorder (current behavior)
        useWebCodecs.current = false;
        recorder.current = createMediaRecorder(liveStream.current, {
          audioBitsPerSecond,
          videoBitsPerSecond,
        });

        try {
          recorder.current.start(1000);
        } catch (err) {
          sendRecordingError(
            "Failed to start recording: " + JSON.stringify(err)
          );
          return;
        }

        recorder.current.onerror = (ev) => {
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "mediarecorder",
            why: String(ev?.error || "unknown"),
          });
        };

        recorder.current.onstop = async () => {
          try {
            recorder.current.requestData();
          } catch {}
          if (isRestarting.current) return;
          await waitForDrain();
          if (!sentLast.current) {
            sentLast.current = true;
            isFinishing.current = false;
            chrome.runtime.sendMessage({ type: "video-ready" });
          }
        };

        recorder.current.ondataavailable = async (e) => {
          if (!e || !e.data || !e.data.size) {
            if (
              recorder.current instanceof MediaRecorder &&
              recorder.current.state === "inactive"
            ) {
              chrome.storage.local.set({
                recording: false,
                restarting: false,
                tabRecordedID: null,
              });
              sendStopRecording();
            }
            return;
          }

          await handleChunk(e.data, e.timecode ?? 0);
        };
      }
    } catch (err) {
      sendRecordingError(JSON.stringify(err));
      return;
    }

    // Same audio/video track onended logic
    if (helperAudioStream.current) {
      const track = helperAudioStream.current.getAudioTracks()[0];
      if (track) {
        track.onended = () => {
          chrome.storage.local.set({ recording: false });
          sendStopRecording();
        };
      }
    }

    liveStream.current.getVideoTracks()[0].onended = () => {
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
      });
      sendStopRecording();
    };

    helperVideoStream.current.getVideoTracks()[0].onended = () => {
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
      });
      sendStopRecording();
    };
  }

  async function assembleAndDownload() {
    const keys = await chunksStore.keys();
    const items = await Promise.all(keys.map((k) => chunksStore.getItem(k)));
    const ordered = items.sort((a, b) => a.index - b.index);

    const blob = new Blob(
      ordered.map((o) => o.chunk),
      {
        type: "video/mp4",
      }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recording.mp4";
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 2000);

    console.log(
      "[RECORDER] Auto-downloaded recording.mp4",
      ordered.length,
      "chunks"
    );
  }

  async function stopRecording() {
    if (isFinishing.current) {
      console.log("[RECORDER] stopRecording ignored (already running)");
      return;
    }
    isFinishing.current = true;

    try {
      if (
        useWebCodecs.current &&
        recorder.current instanceof WebCodecsRecorder
      ) {
        await recorder.current.stop();
      } else if (recorder.current instanceof MediaRecorder) {
        try {
          recorder.current.requestData();
        } catch {}
        if (recorder.current.state !== "inactive") {
          recorder.current.stop();
        }
      }
    } catch {}

    await waitForDrain();
    recorder.current = null;

    if (liveStream.current) {
      liveStream.current.getTracks().forEach((t) => t.stop());
      liveStream.current = null;
    }

    if (helperVideoStream.current) {
      helperVideoStream.current.getTracks().forEach((t) => t.stop());
      helperVideoStream.current = null;
    }

    if (helperAudioStream.current) {
      helperAudioStream.current.getTracks().forEach((t) => t.stop());
      helperAudioStream.current = null;
    }
  }

  const dismissRecording = async () => {
    isRestarting.current = true;
    if (recorder.current !== null) {
      recorder.current.stop();
      recorder.current = null;
    }
    window.close();
  };

  const restartRecording = async () => {
    isRestarting.current = true;
    if (recorder.current !== null) {
      recorder.current.stop();
    }
    recorder.current = null;
    chrome.runtime.sendMessage({ type: "reset-active-tab-restart" });
  };

  async function startAudioStream(id) {
    const audioStreamOptions = {
      mimeType: "video/webm;codecs=vp8,opus",
      audio: {
        deviceId: {
          exact: id,
        },
      },
    };

    const result = await navigator.mediaDevices
      .getUserMedia(audioStreamOptions)
      .then((stream) => {
        return stream;
      })
      .catch((err) => {
        // Try again without the device ID
        const audioStreamOptions = {
          mimeType: "video/webm;codecs=vp8,opus",
          audio: true,
        };

        return navigator.mediaDevices
          .getUserMedia(audioStreamOptions)
          .then((stream) => {
            return stream;
          })
          .catch((err) => {
            return null;
          });
      });

    return result;
  }
  // Set audio input volume
  function setAudioInputVolume(volume) {
    audioInputGain.current.gain.value = volume;
  }

  // Set audio output volume
  function setAudioOutputVolume(volume) {
    audioOutputGain.current.gain.value = volume;
  }

  const setMic = async (result) => {
    if (helperAudioStream.current != null) {
      if (result.active) {
        setAudioInputVolume(1);
      } else {
        setAudioInputVolume(0);
      }
    } else {
      // No microphone available
    }
  };

  async function startStream(data, id, options, permissions, permissions2) {
    // Get quality value
    const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);

    const { width, height } = getResolutionForQuality(qualityValue);

    const { fpsValue } = await chrome.storage.local.get(["fpsValue"]);
    let fps = parseInt(fpsValue);

    // Check if fps is a number
    if (isNaN(fps)) {
      fps = 30;
    }

    // Check if the user selected a tab in desktopcapture
    let userConstraints = {
      audio: {
        deviceId: data.defaultAudioInput,
      },
      video: {
        deviceId: data.defaultVideoInput,
        width: {
          ideal: width,
        },
        height: {
          ideal: height,
        },
        frameRate: {
          ideal: fps,
        },
      },
    };
    if (permissions.state === "denied") {
      userConstraints.video = false;
    }
    if (permissions2.state === "denied") {
      userConstraints.audio = false;
    }

    let userStream;
    if (
      permissions.state != "denied" &&
      permissions2.state != "denied" &&
      data.recordingType === "camera"
    ) {
      userStream = await navigator.mediaDevices.getUserMedia(userConstraints);
    }

    // Save the helper streams
    if (data.recordingType === "camera") {
      helperVideoStream.current = userStream;
    } else {
      const constraints = {
        audio: {
          mandatory: {
            chromeMediaSource: isTab.current ? "tab" : "desktop",
            chromeMediaSourceId: id,
          },
        },
        video: {
          mandatory: {
            chromeMediaSource: isTab.current ? "tab" : "desktop",
            chromeMediaSourceId: id,
            // FLAG: try ideal + max to enforce exact resolution
            // maxWidth: width,
            // maxHeight: height,
            // width: { ideal: width, max: width },
            // height: { ideal: height, max: height },
            maxFrameRate: fps,
          },
        },
      };

      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Check if the stream actually has data in it
        if (stream.getVideoTracks().length === 0) {
          sendRecordingError("No video tracks available");
          return;
        }
      } catch (err) {
        sendRecordingError("Failed to get user media: " + JSON.stringify(err));
        return;
      }

      if (isTab.current) {
        // Continue to play the captured audio to the user.
        const output = new AudioContext();
        const source = output.createMediaStreamSource(stream);
        source.connect(output.destination);
      }

      helperVideoStream.current = stream;

      const surface = stream.getVideoTracks()[0].getSettings().displaySurface;
      chrome.runtime.sendMessage({ type: "set-surface", surface: surface });
    }

    // Create an audio context, destination, and stream
    aCtx.current = new AudioContext();
    destination.current = aCtx.current.createMediaStreamDestination();
    liveStream.current = new MediaStream();

    const micstream = await startAudioStream(data.defaultAudioInput);
    helperAudioStream.current = micstream;

    // Check if micstream has an audio track
    if (
      helperAudioStream.current != null &&
      helperAudioStream.current.getAudioTracks().length > 0
    ) {
      audioInputGain.current = aCtx.current.createGain();
      audioInputSource.current = aCtx.current.createMediaStreamSource(
        helperAudioStream.current
      );
      audioInputSource.current
        .connect(audioInputGain.current)
        .connect(destination.current);
    } else {
      // No microphone available
    }

    if (helperAudioStream.current != null && !data.micActive) {
      setAudioInputVolume(0);
    }

    // Check if stream has an audio track
    if (helperVideoStream.current.getAudioTracks().length > 0) {
      audioOutputGain.current = aCtx.current.createGain();
      audioOutputSource.current = aCtx.current.createMediaStreamSource(
        helperVideoStream.current
      );
      audioOutputSource.current
        .connect(audioOutputGain.current)
        .connect(destination.current);
    } else {
      // No system audio available
    }

    // Add the tracks to the stream
    liveStream.current.addTrack(helperVideoStream.current.getVideoTracks()[0]);
    if (
      (helperAudioStream.current != null &&
        helperAudioStream.current.getAudioTracks().length > 0) ||
      helperVideoStream.current.getAudioTracks().length > 0
    ) {
      liveStream.current.addTrack(
        destination.current.stream.getAudioTracks()[0]
      );
    }

    // Send message to go back to the previously active tab
    setStarted(true);

    chrome.runtime.sendMessage({ type: "reset-active-tab" });
  }

  async function startStreaming(data) {
    // Check user permissions for camera and microphone individually
    const permissions = await navigator.permissions.query({
      name: "camera",
    });
    const permissions2 = await navigator.permissions.query({
      name: "microphone",
    });

    try {
      if (data.recordingType === "camera") {
        startStream(data, null, null, permissions, permissions2);
      } else if (!isTab.current) {
        let captureTypes = ["screen", "window", "tab", "audio"];
        if (tabPreferred.current) {
          captureTypes = ["tab", "screen", "window", "audio"];
        }
        chrome.desktopCapture.chooseDesktopMedia(
          captureTypes,
          null,
          (streamId, options) => {
            if (
              streamId === undefined ||
              streamId === null ||
              streamId === ""
            ) {
              sendRecordingError("User cancelled the modal", true);
              return;
            } else {
              startStream(data, streamId, options, permissions, permissions2);
            }
          }
        );
      } else {
        startStream(data, tabID.current, null, permissions, permissions2);
      }
    } catch (err) {
      sendRecordingError(
        "Failed to start streaming: " + JSON.stringify(err),
        true
      );
    }
  }

  // Check if trying to record from Playground
  useEffect(() => {
    chrome.storage.local.get(["tabPreferred"], (result) => {
      tabPreferred.current = result.tabPreferred;
    });
  }, []);

  const getStreamID = async (id) => {
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: id,
    });
    tabID.current = streamId;
  };

  // FLAG: add protection on page close
  useEffect(() => {
    const handleClose = () => {
      try {
        stopRecording();
      } catch {}
    };

    window.addEventListener("pagehide", handleClose);
    window.addEventListener("beforeunload", handleClose);

    return () => {
      window.removeEventListener("pagehide", handleClose);
      window.removeEventListener("beforeunload", handleClose);
    };
  }, []);

  const onMessage = useCallback(
    (request, sender, sendResponse) => {
      if (request.type === "loaded") {
        backupRef.current = request.backup;
        // FLAG: I don't know why this was a false check before...
        if (!tabPreferred.current) {
          isTab.current = request.isTab;
          if (request.isTab) {
            getStreamID(request.tabID);
          }
        } else {
          isTab.current = false;
        }
        chrome.runtime.sendMessage({ type: "get-streaming-data" });
      } else if (request.type === "streaming-data") {
        startStreaming(JSON.parse(request.data));
      } else if (request.type === "start-recording-tab") {
        startRecording();
      } else if (request.type === "restart-recording-tab") {
        restartRecording();
      } else if (request.type === "stop-recording-tab") {
        stopRecording();
      } else if (request.type === "set-mic-active-tab") {
        setMic(request);
      } else if (request.type === "set-audio-output-volume") {
        setAudioOutputVolume(request.volume);
      } else if (request.type === "pause-recording-tab") {
        if (!recorder.current) return;
        if (
          !useWebCodecs.current &&
          recorder.current instanceof MediaRecorder
        ) {
          recorder.current.pause();
        }
      } else if (request.type === "resume-recording-tab") {
        if (!recorder.current) return;
        if (
          !useWebCodecs.current &&
          recorder.current instanceof MediaRecorder
        ) {
          recorder.current.resume();
        }
      } else if (request.type === "dismiss-recording") {
        dismissRecording();
      }
    },
    [recorder.current, tabPreferred.current]
  );

  useEffect(() => {
    // Event listener (extension messaging)
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return <RecorderUI started={started} isTab={isTab.current} />;
};

export default Recorder;
