import React, { useEffect, useState, useRef, useCallback } from "react";
import localforage from "localforage";

localforage.config({
  driver: localforage.INDEXEDDB, // or choose another driver
  name: "screenity", // optional
  version: 1, // optional
});

// Get chunks store
const chunksStore = localforage.createInstance({
  name: "chunks",
});

const RecorderOffscreen = () => {
  const isRestarting = useRef(false);
  const isFinishing = useRef(false);
  const sentLast = useRef(false);
  const index = useRef(0);
  const lastTimecode = useRef(0);
  const hasChunks = useRef(false);

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
    hasChunks.current = 0;

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

    // I don't know what the ideal chunk size should be here
    try {
      recorder.current.start(3000);
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: JSON.stringify(err),
      });
      return;
    }

    recorder.current.onstop = async (e) => {
      if (isRestarting.current) return;

      setTimeout(() => {
        if (!sentLast.current) {
          chrome.runtime.sendMessage({ type: "video-ready" });
          isFinishing.current = false;
        }
      }, 3000);

      isRestarting.current = false;
    };

    const checkMaxMemory = () => {
      try {
        navigator.storage.estimate().then((data) => {
          const minMemory = 26214400;
          // Check if there's enough space to keep recording
          if (data.quota < minMemory) {
            chrome.runtime.sendMessage({
              type: "stop-recording-tab",
              memoryError: true,
            });
          }
        });
      } catch (err) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: JSON.stringify(err),
        });
      }
    };

    const handleDataAvailable = async (e) => {
      checkMaxMemory();

      if (e.data.size > 0) {
        try {
          const timestamp = e.timecode;
          if (hasChunks.current === false) {
            hasChunks.current = true;
            lastTimecode.current = timestamp;
          } else if (timestamp < lastTimecode.current) {
            // This is a duplicate chunk, ignore it
            return;
          } else {
            lastTimecode.current = timestamp;
          }

          await chunksStore.setItem(`chunk_${index.current}`, {
            index: index.current,
            chunk: e.data,
            timestamp: timestamp,
          });

          if (backupRef.current) {
            chrome.runtime.sendMessage({
              type: "write-file",
              index: index.current,
            });
          }
          index.current++;
        } catch (err) {
          chrome.runtime.sendMessage({
            type: "stop-recording-tab",
            memoryError: true,
          });
        }
      } else {
        // Check MediaRecorder state
        if (recorder.current.state === "inactive") {
          chrome.runtime.sendMessage({
            type: "stop-recording-tab",
            memoryError: true,
          });
        }
      }

      if (isFinishing.current) {
        sentLast.current = true;
        chrome.runtime.sendMessage({ type: "video-ready" });
      }
    };

    recorder.current.ondataavailable = async (e) => {
      await handleDataAvailable(e);
    };

    liveStream.current.getVideoTracks()[0].onended = () => {
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });
    };

    helperVideoStream.current.getVideoTracks()[0].onended = () => {
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });
    };
  }

  async function stopRecording() {
    isFinishing.current = true;
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
    chrome.runtime.sendMessage({ type: "new-sandbox-page-restart" });
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
    if (isNaN(fps)) {
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
        userStream = await navigator.mediaDevices.getUserMedia(userConstraints);
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
                minFrameRate: fps,
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
        recorder.current.pause();
      } else if (request.type === "resume-recording-tab") {
        if (!recorder.current) return;
        recorder.current.resume();
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
