import React, { useEffect, useState, useRef, useCallback } from "react";
import localforage from "localforage";

import Warning from "./warning/Warning";

localforage.config({
  driver: localforage.INDEXEDDB, // or choose another driver
  name: "screenity", // optional
  version: 1, // optional
});

// Get chunks store
const chunksStore = localforage.createInstance({
  name: "chunks",
});

const Recorder = () => {
  const isRestarting = useRef(false);
  const isFinishing = useRef(false);
  const sentLast = useRef(false);
  const lastTimecode = useRef(0);
  const hasChunks = useRef(false);

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

  const isTab = useRef(false);
  const tabID = useRef(null);
  const tabPreferred = useRef(false);

  const backupRef = useRef(false);

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

    chrome.storage.local.set({
      recording: true,
      restarting: false,
    });

    isRestarting.current = false;
    index.current = 0;

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

    recorder.current.onstop = (e) => {
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
            chrome.storage.local.set({
              recording: false,
              restarting: false,
              tabRecordedID: null,
              memoryError: true,
            });
            chrome.runtime.sendMessage({ type: "stop-recording-tab" });
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

      if (e.data.size > 0 && e.timecode) {
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
          chrome.storage.local.set({
            recording: false,
            restarting: false,
            tabRecordedID: null,
            memoryError: true,
          });
          chrome.runtime.sendMessage({ type: "stop-recording-tab" });
        }
      } else {
        // Check Media Recorder state
        if (recorder.current.state === "inactive") {
          chrome.storage.local.set({
            recording: false,
            restarting: false,
            tabRecordedID: null,
          });
          chrome.runtime.sendMessage({ type: "stop-recording-tab" });
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
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
      });
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });
    };

    helperVideoStream.current.getVideoTracks()[0].onended = () => {
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
            maxWidth: width,
            maxHeight: height,
            maxFrameRate: fps,
          },
        },
      };

      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Check if the stream actually has data in it
        if (stream.getVideoTracks().length === 0) {
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "stream-error",
            why: "No video tracks available",
          });
          return;
        }
      } catch (err) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: JSON.stringify(err),
        });
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
              chrome.runtime.sendMessage({
                type: "recording-error",
                error: "cancel-modal",
                why: "User cancelled the modal",
              });
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
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "cancel-modal",
        why: JSON.stringify(err),
      });
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

  const onMessage = useCallback(
    (request, sender, sendResponse) => {
      if (request.type === "loaded") {
        backupRef.current = request.backup;
        if (!tabPreferred.current) {
          isTab.current = request.isTab;
          if (request.isTab) {
            getStreamID(request.tabID);
          }
        } else {
          isTab.current = false;
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
    [recorder.current, tabPreferred.current]
  );

  useEffect(() => {
    // Event listener (extension messaging)
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return (
    <div className="wrap">
      <img
        className="logo"
        src={chrome.runtime.getURL("assets/logo-text.svg")}
      />
      <div className="middle-area">
        <img src={chrome.runtime.getURL("assets/record-tab-active.svg")} />
        <div className="title">
          {!started
            ? chrome.i18n.getMessage("recorderSelectTitle")
            : chrome.i18n.getMessage("recorderSelectProgressTitle")}
        </div>
        <div className="subtitle">
          {chrome.i18n.getMessage("recorderSelectDescription")}
        </div>
        {/*started && (
          <div
            className="button-stop"
            onClick={() => {
              chrome.runtime.sendMessage({ type: "stop-recording-tab" });
            }}
          >
            {chrome.i18n.getMessage("stopRecording")}
          </div>
					)*/}
      </div>
      {!isTab.current && !started && <Warning />}
      <div className="setupBackgroundSVG"></div>
      <style>
        {`
				body {
					overflow: hidden;
				}
				.button-stop {
					padding: 10px 20px;
					background: #FFF;
					border-radius: 30px;
					color: #29292F;
					font-size: 14px;
					font-weight: 500;
					cursor: pointer;
					margin-top: 0px;
					border: 1px solid #E8E8E8;
					margin-left: auto;
					margin-right: auto;
					z-index: 999999;
				}
				.setupBackgroundSVG {
					position: absolute;
					top: 0px;
					left: 0px;
					width: 100%;
					height:100%;
					background: url('` +
          chrome.runtime.getURL("assets/helper/pattern-svg.svg") +
          `') repeat;
					background-size: 62px 23.5px;
					animation: moveBackground 138s linear infinite;
					transform: rotate(0deg);
				}
				
				@keyframes moveBackground {
					0% {
						background-position: 0 0;
					}
					100% {
						background-position: 100% 0;
					}
				}
				.logo {
					position: absolute;
					bottom: 30px;
					left: 0px;
					right: 0px;
					margin: auto;
					width: 120px;
				}
				.wrap {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background-color: #F6F7FB;
				}
					.middle-area {
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						height: 100%;
						font-family: "Satoshi Medium", sans-serif;
					}
					.middle-area img {
						width: 40px;
						margin-bottom: 20px;
					}
					.title {
						font-size: 24px;
						font-weight: 700;
						color: #1A1A1A;
						margin-bottom: 14px;
						font-family: Satoshi-Medium, sans-serif;
					}
					.subtitle {
						font-size: 14px;
						font-weight: 400;
						color: #6E7684;
						margin-bottom: 24px;
						font-family: Satoshi-Medium, sans-serif;
					}
					
					`}
      </style>
    </div>
  );
};

export default Recorder;
