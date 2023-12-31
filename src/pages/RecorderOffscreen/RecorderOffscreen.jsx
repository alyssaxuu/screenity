import React, { useEffect, useState, useRef, useCallback } from "react";
import Localbase from "localbase";

let db = new Localbase("db");

const RecorderOffscreen = () => {
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

    // I don't know what the ideal chunk size should be here
    chrome.storage.local.get(["quality"], (result) => {
      recorder.current.start(1000, {
        videoBitsPerSecond: result.quality === "max" ? 2000000 : 1000,
        mimeType: "video/webm; codecs=vp9",

        // vp8, opus ?
      });
    });

    recorder.current.onstop = async (e) => {
      if (isRestarting.current) return;
      isLastChunk.current = true;
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
      isRestarting.current = false;
    };

    recorder.current.ondataavailable = async (e) => {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(e.data);
      reader.onloadend = function () {
        const base64data = reader.result;
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
    isSending.current = false;
    if (recorder.current !== null) {
      recorder.current.stop();
    }
    recorder.current = null;
    isLastChunk.current = false;
    chunkQueue.current = [];
    isSending.current = false;
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

  async function startStreaming(data) {
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
        if (isTab.current) {
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
              },
            },
          });
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

      db.collection("blobs").set([]);
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
      console.log("No microphone available");
    }
  };

  const onMessage = useCallback((request, sender, sendResponse) => {
    if (request.type === "loaded") {
      isTab.current = request.isTab;
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
    } else if (request.type === "next-chunk-tab") {
      isSending.current = false;
      sendNextChunk(); // Send the next chunk in the queue
      if (
        isLastChunk.current &&
        chunkQueue.current.length === 0 &&
        !isRestarting.current &&
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

  return <div className="wrap"></div>;
};

export default RecorderOffscreen;
