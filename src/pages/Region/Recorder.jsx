import React, { useEffect, useRef, useCallback } from "react";
import { getUserMediaWithFallback } from "../utils/mediaDeviceFallback";

import localforage from "localforage";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

// Get chunks store
const chunksStore = localforage.createInstance({
  name: "chunks",
});

const Recorder = () => {
  const isRestarting = useRef(false);
  const isDismissing = useRef(false);
  const isFinishing = useRef(false);
  const isFinished = useRef(false);
  const sentLast = useRef(false);
  const index = useRef(0);
  const lastTimecode = useRef(0);
  const hasChunks = useRef(false);
  const lastSize = useRef(0);
  const pausedStateRef = useRef(false);

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

  // Target
  const target = useRef(null);

  // Recording ref
  const recordingRef = useRef();
  const regionRef = useRef();
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
        "[Region Recorder] Failed to persist recording timing state",
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
      // Reload this iframe
      window.location.reload();
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
      // Reload this iframe
      window.location.reload();
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
          // Reload this iframe
          window.location.reload();
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
    window.parent.postMessage(
      {
        type: "screenity-region-capture-loaded",
      },
      "*"
    );
  }, []);

  // Receive post message from parent (this is an iframe)
  useEffect(() => {
    const onMessage = (event) => {
      if (event.data.type === "crop-target") {
        target.current = event.data.target;
        regionRef.current = true;
      } else if (event.data.type === "restart-recording") {
        restartRecording();
      }
    };
    window.addEventListener("message", (event) => {
      onMessage(event);
    });

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  async function startRecording() {
    // Check that a recording is not already in progress
    if (recorder.current !== null) return;
    navigator.storage.persist();
    isFinishing.current = false;
    sentLast.current = false;
    lastTimecode.current = 0;
    lastSize.current = 0;
    hasChunks.current = false;
    isFinished.current = false;
    savedCount.current = 0;
    pending.current = [];
    draining.current = false;
    lowStorageAbort.current = false;
    pendingBytes.current = 0;
    // Check if the stream actually has data in it
    try {
      if (helperVideoStream.current.getVideoTracks().length === 0) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: "No video tracks available",
        });

        // Reload this iframe
        window.location.reload();
        return;
      }
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: JSON.stringify(err),
      });

      // Reload this iframe
      window.location.reload();
      return;
    }

    await chunksStore.clear();

    try {
      const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);

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

        // Reload this iframe
        window.location.reload();
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

      // Reload this iframe
      window.location.reload();
      return;
    }

    isRestarting.current = false;
    index.current = 0;
    recordingRef.current = true;
    isDismissing.current = false;

    try {
      recorder.current.start(1000);
    } catch (err) {
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
      });
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });

      // Reload this iframe
      window.location.reload();
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
      try {
        recorder.current.requestData();
      } catch {}

      regionRef.current = false;
      recordingRef.current = false;

      if (isRestarting.current) return;

      await waitForDrain();

      if (!sentLast.current) {
        sentLast.current = true;
        isFinished.current = true;
        chrome.runtime.sendMessage({ type: "video-ready" });
        isFinishing.current = false;
        window.location.reload();
      }
    };

    const checkMaxMemory = () => {
      try {
        navigator.storage.estimate().then(({ usage = 0, quota = 0 }) => {
          const remaining = quota - usage;
          const minHeadroom = 25 * 1024 * 1024;
          if (remaining < minHeadroom) {
            chrome.storage.local.set({
              recording: false,
              restarting: false,
              tabRecordedID: null,
              memoryError: true,
            });
            chrome.runtime.sendMessage({ type: "stop-recording-tab" });

            // Reload this iframe
            window.location.reload();
          }
        });
      } catch (err) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: JSON.stringify(err),
        });

        // Reload this iframe
        window.location.reload();
      }
    };

    recorder.current.ondataavailable = async (e) => {
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

      if (pendingBytes.current > MAX_PENDING_BYTES) {
        try {
          recorder.current.pause();
          await drainQueue();
          recorder.current.resume();
        } catch {}
      }

      void drainQueue();
    };

    recorder.current.onpause = () => {
      lastTimecode.current = 0;
    };

    recorder.current.onresume = () => {
      lastTimecode.current = 0;
      lastSize.current = 0;
    };

    liveStream.current.getVideoTracks()[0].onended = () => {
      regionRef.current = false;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
      });
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });
    };

    const vTrack = liveStream.current.getVideoTracks()[0];
    if (vTrack) {
      vTrack.oninactive = () => {
        chrome.runtime.sendMessage({ type: "stop-recording-tab" });
      };
    }

    const aTrack = helperAudioStream.current?.getAudioTracks()[0];
    if (aTrack) {
      aTrack.oninactive = () => {
        chrome.runtime.sendMessage({ type: "stop-recording-tab" });
      };
    }

    helperVideoStream.current.getVideoTracks()[0].onended = () => {
      regionRef.current = false;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
      });
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });
    };
  }

  async function stopRecording() {
    isFinishing.current = true;
    regionRef.current = false;
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

      try {
        if (recorder.current.state !== "inactive") {
          recorder.current.stop();
        }
      } catch {}

      await waitForDrain();
      recorder.current = null;
    }

    if (liveStream.current !== null) {
      liveStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      liveStream.current = null;
    }

    if (helperVideoStream.current !== null) {
      helperVideoStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      helperVideoStream.current = null;
    }

    if (helperAudioStream.current !== null) {
      helperAudioStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      helperAudioStream.current = null;
    }
  }

  const dismissRecording = async () => {
    regionRef.current = false;
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
    chrome.runtime.sendMessage({ type: "handle-dismiss" });
    isRestarting.current = true;
    isDismissing.current = true;
    if (recorder.current !== null) {
      recorder.current.stop();
      recorder.current = null;
    }
    if (liveStream.current !== null) {
      liveStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      liveStream.current = null;
    }

    if (helperVideoStream.current !== null) {
      helperVideoStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      helperVideoStream.current = null;
    }

    if (helperAudioStream.current !== null) {
      helperAudioStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      helperAudioStream.current = null;
    }
  };

  const restartRecording = async () => {
    isRestarting.current = true;
    isDismissing.current = false;
    pausedStateRef.current = false;
    if (recorder.current) {
      recorder.current.stop();
    }

    recorder.current = null;
    chrome.runtime.sendMessage({ type: "reset-active-tab-restart" });

    // Send message to go back to the previously active tab
    //chrome.runtime.sendMessage({ type: "reset-active-tab-restart" });
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
    try {
      // Get quality value
      const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);

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

      const { fpsValue } = await chrome.storage.local.get(["fpsValue"]);
      let fps = parseInt(fpsValue);

      // Check if fps is a number
      if (isNaN(fps)) {
        fps = 30;
      }

      let stream;

      const constraints = {
        preferCurrentTab: true,
        audio: data.systemAudio,
        video: {
          frameRate: fps,
          width: {
            ideal: width,
          },
          height: {
            ideal: height,
          },
        },
      };
      stream = await navigator.mediaDevices.getDisplayMedia(constraints);

      helperVideoStream.current = stream;

      // Create an audio context, destination, and stream
      aCtx.current = new AudioContext();
      destination.current = aCtx.current.createMediaStreamDestination();
      liveStream.current = new MediaStream();
      const micstream = await startAudioStream(data.defaultAudioInput);

      // Save the helper streams
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

      try {
        if (target.current) {
          const track = liveStream.current.getVideoTracks()[0];
          await track.cropTo(target.current);
        } else {
          // No target
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "cancel-modal",
            why: "No target",
          });

          // Reload this iframe
          window.location.reload();
        }
      } catch (err) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "cancel-modal",
          why: JSON.stringify(err),
        });

        // Reload this iframe
        window.location.reload();
      }

      // Send message to go back to the previously active tab
      chrome.runtime.sendMessage({ type: "reset-active-tab" });
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "cancel-modal",
        why: JSON.stringify(err),
      });

      // Reload this iframe
      window.location.reload();
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

  useEffect(() => {
    window.addEventListener("beforeunload", (e) => {
      if (recordingRef.current && regionRef.current) {
        e.preventDefault();
        e.returnValue = "";

        // Save and stop recording
        stopRecording();
      }
    });
  }, []);

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
        if (request.region) {
          chrome.runtime.sendMessage({ type: "get-streaming-data" });
        }
      }
      if (request.type === "streaming-data") {
        if (regionRef.current) {
          startStreaming(JSON.parse(request.data));
        }
      } else if (request.type === "start-recording-tab") {
        if (regionRef.current) {
          startRecording();
        }
      } else if (request.type === "stop-recording-tab") {
        if (isFinishing.current) return;
        stopRecording();
      } else if (request.type === "set-mic-active-tab") {
        setMic(request);
      } else if (request.type === "set-audio-output-volume") {
        setAudioOutputVolume(request.volume);
      } else if (request.type === "pause-recording-tab") {
        if (!recorder.current) return;
        if (pausedStateRef.current) return;
        recorder.current.pause();
        const now = Date.now();
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
              "[Region Recorder] Failed to update resume timing state",
              err
            );
          }
        })();
      } else if (request.type === "dismiss-recording") {
        dismissRecording();
      }
    },
    [regionRef.current, isFinishing.current, recorder.current]
  );

  useEffect(() => {
    // Event listener (extension messaging)
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return <div></div>;
};

export default Recorder;
