import React, { useEffect, useState, useRef, useCallback } from "react";
import Localbase from "localbase";

let db = new Localbase("db");

const Recorder = () => {
  const chunkQueue = useRef([]);
  const isSending = useRef(false);
  const isRestarting = useRef(false);
  const isLastChunk = useRef(false);
  const isFinished = useRef(false);
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

  async function startRecording() {
    // Clear chunks collection
    db.collection("chunks").delete();
    recorder.current = new MediaRecorder(liveStream.current);

    isFinished.current = false;
    isLastChunk.current = false;
    isSending.current = false;
    chunkQueue.current = [];
    isRestarting.current = false;
    index.current = 0;

    chrome.storage.local.get(["quality"], (result) => {
      // I don't know what the ideal chunk size should be here
      recorder.current.start(3000, {
        videoBitsPerSecond: result.quality === "max" ? 2000000 : 1000,
        mimeType: "video/webm; codecs=vp9",
        // vp8, opus ?
      });
    });

    recorder.current.onstop = async (e) => {
      if (isRestarting.current) return;
      isLastChunk.current = true;
      setTimeout(() => {
        if (
          chunkQueue.current.length === 0 &&
          !isRestarting.current &&
          !isSending.current &&
          !isFinished.current
        ) {
          isFinished.current = true;
          chrome.runtime.sendMessage({ type: "video-ready" });
          chunkQueue.current = [];
          isSending.current = false;
        }
      }, 1000);

      setTimeout(() => {
        isFinished.current = true;
        chrome.runtime.sendMessage({ type: "video-ready" });
        chunkQueue.current = [];
        isSending.current = false;
      }, 5000);
    };

    recorder.current.ondataavailable = async (e) => {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(e.data);

      reader.onloadend = function () {
        const base64data = reader.result;
        // Save to localbase
        db.collection("chunks").add({
          index: index.current,
          chunk: base64data,
        });
        chunkQueue.current.push(base64data);

        // If no message is currently being sent, start sending chunks from the queue
        if (!isSending.current) {
          sendNextChunk();
        }
      };
    };

    liveStream.current.getVideoTracks()[0].onended = () => {
      chrome.storage.local.set({ recording: false });
      recorder.current.stop();
    };
  }

  const sendNextChunk = () => {
    if (isFinished.current) return;
    if (isRestarting.current) return;

    if (chunkQueue.current.length > 0) {
      isSending.current = true;
      const chunk = chunkQueue.current.shift();
      index.current += 1;
      chrome.runtime.sendMessage({
        type: "new-chunk",
        chunk: chunk,
        index: index.current,
      });
    } else {
      isSending.current = false;
    }
  };

  async function stopRecording() {
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
    isSending.current = false;
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
    isSending.current = false;
    recorder.current = null;
    isLastChunk.current = false;
    chunkQueue.current = [];
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
        return null;
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
      console.log("No microphone available");
    }
  };

  async function startStream(data, id, options, permissions, permissions2) {
    // Check if the user selected a tab in desktopcapture
    let userConstraints = {
      audio: {
        deviceId: data.defaultAudioInput,
      },
      video: {
        deviceId: data.defaultVideoInput,
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
            minWidth: window.innerWidth,
            minHeight: window.innerHeight,
            maxWidth: window.screen.width,
            maxHeight: window.screen.height,
          },
        },
      };

      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
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
      console.log("No microphone available");
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
      console.log("No system audio available");
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

    db.collection("blobs").set([]);
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

  const onMessage = useCallback((request, sender, sendResponse) => {
    if (request.type === "loaded") {
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
    } else if (request.type === "next-chunk-tab") {
      if (isRestarting.current) return;
      isSending.current = false;
      sendNextChunk(); // Send the next chunk in the queue
      if (
        isLastChunk.current &&
        chunkQueue.current.length === 0 &&
        !isFinished.current
      ) {
        isFinished.current = true;
        chrome.runtime.sendMessage({ type: "video-ready" });
        isLastChunk.current = false;
      }
    } else if (request.type === "pause-recording-tab") {
      if (!recorder.current) return;
      recorder.current.pause();
    } else if (request.type === "resume-recording-tab") {
      if (!recorder.current) return;
      recorder.current.resume();
    } else if (request.type === "dismiss-recording") {
      dismissRecording();
    }
  });

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
