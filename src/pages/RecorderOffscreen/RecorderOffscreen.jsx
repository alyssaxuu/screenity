import React, { useEffect, useState, useRef, useCallback } from "react";
import localforage from "localforage";
import { getUserMediaWithFallback } from "../utils/mediaDeviceFallback";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

// Get chunks store
const chunksStore = localforage.createInstance({
  name: "chunks",
});

const RecorderOffscreen = () => {
  const isRestarting = useRef(false);
  const isFinishing = useRef(false);
  const sentLast = useRef(false);
  const lastSize = useRef(0);
  const index = useRef(0);
  const lastTimecode = useRef(0);
  const hasChunks = useRef(false);
  const pausedStateRef = useRef(false);

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

  const isTab = useRef(false);
  const tabID = useRef(null);
  const quality = useRef("1080p");
  const fps = useRef(30);
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

  const setRecordingTimingState = async (nextState) => {
    try {
      await chrome.storage.local.set(nextState);
    } catch (err) {
      console.warn(
        "[RecorderOffscreen] Failed to persist recording timing state",
        err
      );
    }
  };

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

    if (
      savedCount.current > 0 &&
      ts === lastTimecode.current &&
      e.data.size === lastSize.current
    ) {
      return false;
    }

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
  // End FLAG

  async function startRecording() {
    // Check that a recording is not already in progress
    if (recorder.current !== null) return;
    navigator.storage.persist();
    // Check if the stream actually has data in it
    if (helperVideoStream.current.getVideoTracks().length === 0) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: "No video tracks available",
      });
      return;
    }

    chunksStore.clear();

    lastTimecode.current = 0;
    lastSize.current = 0;
    hasChunks.current = false;
    savedCount.current = 0;
    pending.current = [];
    draining.current = false;
    lowStorageAbort.current = false;
    pendingBytes.current = 0;

    try {
      const qualityValue = quality.current;

      let audioBitsPerSecond = 128000;
      let videoBitsPerSecond = 5000000;

      if (qualityValue === "4k") {
        audioBitsPerSecond = 192000;
        videoBitsPerSecond = 40000000;
      } else if (qualityValue === "1080p") {
        audioBitsPerSecond = 192000;
        videoBitsPerSecond = 8000000;
      } else if (qualityValue === "720p") {
        audioBitsPerSecond = 128000;
        videoBitsPerSecond = 5000000;
      } else if (qualityValue === "480p") {
        audioBitsPerSecond = 96000;
        videoBitsPerSecond = 2500000;
      } else if (qualityValue === "360p") {
        audioBitsPerSecond = 96000;
        videoBitsPerSecond = 1000000;
      } else if (qualityValue === "240p") {
        audioBitsPerSecond = 64000;
        videoBitsPerSecond = 500000;
      }

      // List all mimeTypes
      const mimeTypes = [
        "video/webm;codecs=avc1",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm;codecs=h264",
        "video/webm",
      ];

      // Check if the browser supports any of the mimeTypes, make sure to select the first one that is supported from the list
      let mimeType = mimeTypes.find((mimeType) =>
        MediaRecorder.isTypeSupported(mimeType)
      );

      // If no mimeType is supported, throw an error
      if (!mimeType) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: "No supported mimeTypes available",
        });
        return;
      }

      recorder.current = new MediaRecorder(liveStream.current, {
        mimeType: mimeType,
        audioBitsPerSecond: audioBitsPerSecond,
        videoBitsPerSecond: videoBitsPerSecond,
      });
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: JSON.stringify(err),
      });
      return;
    }

    isRestarting.current = false;
    index.current = 0;

    try {
      recorder.current.start(1000);
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: JSON.stringify(err),
      });
      return;
    }

    const recordingStartTime = Date.now();
    await setRecordingTimingState({
      recording: true,
      paused: false,
      recordingStartTime,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
    chrome.storage.local.set({
      recording: true,
      restarting: false,
    });

    recorder.current.onerror = (ev) => {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "mediarecorder",
        why: String(ev?.error || "unknown"),
      });
    };

    recorder.current.onstop = async () => {
      if (isRestarting.current) return;
      await waitForDrain();
      if (!sentLast.current) {
        sentLast.current = true;
        isFinishing.current = false;
        chrome.runtime.sendMessage({ type: "video-ready" });
      }
    };

    recorder.current.ondataavailable = (e) => {
      if (!e || !e.data || !e.data.size) {
        if (recorder.current && recorder.current.state === "inactive") {
          chrome.storage.local.set({
            recording: false,
            restarting: false,
            tabRecordedID: null,
          });
          chrome.runtime.sendMessage({ type: "stop-recording-tab" });
        }
        return;
      }

      if (lowStorageAbort.current) {
        return;
      }

      if (!hasChunks.current) {
        hasChunks.current = true;
        lastTimecode.current = e.timecode ?? 0;
        lastSize.current = e.data.size;
      }

      pending.current.push(e);
      pendingBytes.current += e.data.size;
      void drainQueue();
    };

    recorder.current.onpause = () => {
      lastTimecode.current = 0;
      lastSize.current = 0;
    };

    recorder.current.onresume = () => {
      lastTimecode.current = 0;
      lastSize.current = 0;
    };

    liveStream.current.getVideoTracks()[0].onended = () => {
      const track = liveStream.current?.getVideoTracks()[0];
      // Log detailed diagnostics for debugging
      const diagnosticInfo = {
        reason: "liveStream-video-track-ended-offscreen",
        savedChunks: savedCount.current,
        lastTimecode: lastTimecode.current,
        trackLabel: track?.label || null,
        trackReadyState: track?.readyState || null,
      };
      console.warn(
        "[RecorderOffscreen] liveStream video track ended",
        diagnosticInfo
      );
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        lastTrackEndEvent: diagnosticInfo,
      });
      chrome.runtime.sendMessage({
        type: "stop-recording-tab",
        reason: "video-track-ended",
      });
    };

    helperVideoStream.current.getVideoTracks()[0].onended = () => {
      const track = helperVideoStream.current?.getVideoTracks()[0];
      // Log detailed diagnostics for debugging
      const diagnosticInfo = {
        reason: "helperVideoStream-video-track-ended-offscreen",
        savedChunks: savedCount.current,
        lastTimecode: lastTimecode.current,
        trackLabel: track?.label || null,
        trackReadyState: track?.readyState || null,
      };
      console.warn(
        "[RecorderOffscreen] helperVideoStream video track ended",
        diagnosticInfo
      );
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        lastTrackEndEvent: diagnosticInfo,
      });
      chrome.runtime.sendMessage({
        type: "stop-recording-tab",
        reason: "video-track-ended",
      });
    };
  }

  async function stopRecording() {
    isFinishing.current = true;
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
    if (recorder.current) {
      try {
        recorder.current.requestData();
      } catch {}
      recorder.current.stop();
      await waitForDrain();
      recorder.current = null;
    }

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
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
    isRestarting.current = true;
    if (recorder.current !== null) {
      recorder.current.stop();
      recorder.current = null;
    }
    window.close();
  };

  const restartRecording = async () => {
    isRestarting.current = true;
    pausedStateRef.current = false;
    if (recorder.current !== null) {
      recorder.current.stop();
    }
    recorder.current = null;
    chrome.runtime.sendMessage({ type: "reset-active-tab-restart" });
  };

  async function startAudioStream(id) {
    const useExact = id && id !== "none";
    const audioStreamOptions = {
      mimeType: "video/webm;codecs=vp8,opus",
      audio: useExact
        ? {
            deviceId: {
              exact: id,
            },
          }
        : true,
    };

    const { defaultAudioInputLabel, audioinput } =
      await chrome.storage.local.get([
        "defaultAudioInputLabel",
        "audioinput",
      ]);
    const desiredLabel =
      defaultAudioInputLabel ||
      audioinput?.find((device) => device.deviceId === id)?.label ||
      "";

    const result = await getUserMediaWithFallback({
      constraints: audioStreamOptions,
      fallbacks:
        useExact && desiredLabel
          ? [
              {
                kind: "audioinput",
                desiredDeviceId: id,
                desiredLabel,
                onResolved: (resolvedId) => {
                  chrome.storage.local.set({
                    defaultAudioInput: resolvedId,
                    defaultAudioInputLabel: desiredLabel,
                  });
                },
              },
            ]
          : [],
    })
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

  async function startStreaming(data) {
    // Get quality value
    const qualityValue = quality.current;

    let width = 1920;
    let height = 1080;

    if (qualityValue === "4k") {
      width = 4096;
      height = 2160;
    } else if (qualityValue === "1080p") {
      width = 1920;
      height = 1080;
    } else if (qualityValue === "720p") {
      width = 1280;
      height = 720;
    } else if (qualityValue === "480p") {
      width = 854;
      height = 480;
    } else if (qualityValue === "360p") {
      width = 640;
      height = 360;
    } else if (qualityValue === "240p") {
      width = 426;
      height = 240;
    }

    const fpsValue = fps.current;
    let fpsVal = parseInt(fpsValue);

    // Check if fps is a number
    if (isNaN(fpsVal)) {
      fpsVal = 30;
    }
    // Check user permissions for camera and microphone individually
    const permissions = await navigator.permissions.query({
      name: "camera",
    });
    const permissions2 = await navigator.permissions.query({
      name: "microphone",
    });

    try {
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
            ideal: fpsVal,
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
        const {
          defaultAudioInputLabel,
          defaultVideoInputLabel,
          audioinput,
          videoinput,
        } = await chrome.storage.local.get([
          "defaultAudioInputLabel",
          "defaultVideoInputLabel",
          "audioinput",
          "videoinput",
        ]);
        const desiredAudioLabel =
          defaultAudioInputLabel ||
          audioinput?.find(
            (device) => device.deviceId === data.defaultAudioInput
          )?.label ||
          "";
        const desiredVideoLabel =
          defaultVideoInputLabel ||
          videoinput?.find(
            (device) => device.deviceId === data.defaultVideoInput
          )?.label ||
          "";

        const hasAudioDevice =
          data.defaultAudioInput && data.defaultAudioInput !== "none";
        const hasVideoDevice =
          data.defaultVideoInput && data.defaultVideoInput !== "none";
        const cameraConstraints = {
          ...userConstraints,
          audio:
            userConstraints.audio && hasAudioDevice
              ? {
                  ...userConstraints.audio,
                  deviceId: { exact: data.defaultAudioInput },
                }
              : userConstraints.audio,
          video:
            userConstraints.video && hasVideoDevice
              ? {
                  ...userConstraints.video,
                  deviceId: { exact: data.defaultVideoInput },
                }
              : userConstraints.video,
        };

        userStream = await getUserMediaWithFallback({
          constraints: cameraConstraints,
          fallbacks: [
            hasVideoDevice && desiredVideoLabel
              ? {
                  kind: "videoinput",
                  desiredDeviceId: data.defaultVideoInput,
                  desiredLabel: desiredVideoLabel,
                  onResolved: (resolvedId) => {
                    chrome.storage.local.set({
                      defaultVideoInput: resolvedId,
                      defaultVideoInputLabel: desiredVideoLabel,
                    });
                  },
                }
              : null,
            hasAudioDevice && desiredAudioLabel
              ? {
                  kind: "audioinput",
                  desiredDeviceId: data.defaultAudioInput,
                  desiredLabel: desiredAudioLabel,
                  onResolved: (resolvedId) => {
                    chrome.storage.local.set({
                      defaultAudioInput: resolvedId,
                      defaultAudioInputLabel: desiredAudioLabel,
                    });
                  },
                }
              : null,
          ].filter(Boolean),
        });
      }

      // Create an audio context, destination, and stream
      aCtx.current = new AudioContext();
      destination.current = aCtx.current.createMediaStreamDestination();
      liveStream.current = new MediaStream();

      const micstream = await startAudioStream(data.defaultAudioInput);

      // Save the helper streams
      if (data.recordingType === "camera") {
        helperVideoStream.current = userStream;
      } else {
        let stream;
        if (isTab.current === true) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: "tab",
                chromeMediaSourceId: tabID.current,
              },
            },
            video: {
              mandatory: {
                chromeMediaSource: "tab",
                chromeMediaSourceId: tabID.current,
                maxWidth: width,
                maxHeight: height,
                maxFrameRate: fpsVal,
              },
            },
          });

          // Check if the stream actually has data in it
          if (stream.getVideoTracks().length === 0) {
            chrome.runtime.sendMessage({
              type: "recording-error",
              error: "stream-error",
              why: "No video tracks available",
            });
            return;
          }
        } else {
          stream = await navigator.mediaDevices.getDisplayMedia({
            audio: data.systemAudio,
            video: {
              frameRate: 30,
              displaySurface: "monitor",
            },
            selfBrowserSurface: "exclude",
            systemAudio: "include",
          });

          // Check if the stream actually has data in it
          if (stream.getVideoTracks().length === 0) {
            chrome.runtime.sendMessage({
              type: "recording-error",
              error: "stream-error",
              why: "No video tracks available",
            });
            return;
          }
        }
        helperVideoStream.current = stream;

        const surface = stream.getVideoTracks()[0].getSettings().displaySurface;
        chrome.runtime.sendMessage({ type: "set-surface", surface: surface });
      }
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
      liveStream.current.addTrack(
        helperVideoStream.current.getVideoTracks()[0]
      );
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
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "cancel-modal",
        why: JSON.stringify(err),
      });
    }
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

  const onMessage = useCallback(
    (request, sender, sendResponse) => {
      if (request.type === "loaded") {
        backupRef.current = request.backup;
        isTab.current = request.isTab;
        quality.current = request.quality;
        fps.current = request.fps;
        if (request.isTab) {
          tabID.current = request.tabID;
        }
        chrome.runtime.sendMessage({ type: "get-streaming-data" });
      }
      if (request.type === "streaming-data") {
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
        if (pausedStateRef.current) return;
        const now = Date.now();
        recorder.current.pause();
        pausedStateRef.current = true;
        void setRecordingTimingState({
          paused: true,
          pausedAt: now,
        });
      } else if (request.type === "resume-recording-tab") {
        if (!recorder.current) return;
        if (!pausedStateRef.current) return;
        recorder.current.resume();
        const now = Date.now();
        pausedStateRef.current = false;
        void (async () => {
          try {
            const { pausedAt, totalPausedMs } = await chrome.storage.local.get([
              "pausedAt",
              "totalPausedMs",
            ]);
            const additional = pausedAt ? Math.max(0, now - pausedAt) : 0;
            await setRecordingTimingState({
              paused: false,
              pausedAt: null,
              totalPausedMs: (totalPausedMs || 0) + additional,
            });
          } catch (err) {
            console.warn(
              "[RecorderOffscreen] Failed to update resume timing state",
              err
            );
          }
        })();
      } else if (request.type === "dismiss-recording") {
        dismissRecording();
      }
    },
    [recorder.current]
  );

  useEffect(() => {
    // Event listener (extension messaging)
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return <div className="wrap"></div>;
};

export default RecorderOffscreen;
