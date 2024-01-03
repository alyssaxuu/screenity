import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useContext,
} from "react";
import Localbase from "localbase";

let db = new Localbase("db");

const Recorder = () => {
  const chunkQueue = useRef([]);
  const isSending = useRef(false);
  const isRestarting = useRef(false);
  const isLastChunk = useRef(false);
  const isFinished = useRef(false);
  const isDismissing = useRef(false);
  const index = useRef(0);

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
    // Clear chunks collection
    db.collection("chunks").delete();
    try {
      recorder.current = new MediaRecorder(liveStream.current);
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: JSON.stringify(err),
      });
    }

    isFinished.current = false;
    isLastChunk.current = false;
    isSending.current = false;
    chunkQueue.current = [];
    isRestarting.current = false;
    index.current = 0;
    recordingRef.current = true;

    // I don't know what the ideal chunk size should be here
    try {
      chrome.storage.local.get(["quality"], (result) => {
        recorder.current.start(3000, {
          videoBitsPerSecond: result.quality === "max" ? 2000000 : 1000,
          mimeType: "video/webm; codecs=vp9",

          // vp8, opus ?
        });
      });
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: JSON.stringify(err),
      });
    }

    recorder.current.onstop = async (e) => {
      recordingRef.current = false;
      if (isRestarting.current) return;
      if (!isDismissing.current) {
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
      } else {
        isDismissing.current = false;
      }
    };

    recorder.current.ondataavailable = async (e) => {
      if (isRestarting.current) return;
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
    regionRef.current = false;

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
    regionRef.current = false;
    chrome.runtime.sendMessage({ type: "handle-dismiss" });
    isRestarting.current = true;
    isSending.current = false;
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
    if (recorder.current) {
      recorder.current.stop();
    }
    isSending.current = false;
    recorder.current = null;
    isLastChunk.current = false;
    chunkQueue.current = [];
    chrome.runtime.sendMessage({ type: "new-sandbox-page-restart" });

    // Send message to go back to the previously active tab
    //chrome.runtime.sendMessage({ type: "reset-active-tab-restart" });
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
    try {
      let stream;

      const constraints = {
        preferCurrentTab: true,
        audio: data.systemAudio,
        video: {
          frameRate: 30,
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

      if (target.current) {
        const track = liveStream.current.getVideoTracks()[0];
        await track.cropTo(target.current);
      }

      // Send message to go back to the previously active tab
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
      console.log("No microphone available");
    }
  };

  const onMessage = useCallback((request, sender, sendResponse) => {
    if (request.type === "loaded") {
      if (request.region) {
        chrome.runtime.sendMessage({ type: "get-streaming-data" });
      }
    }
    if (request.type === "streaming-data") {
      if (regionRef.current) {
        startStreaming(JSON.parse(request.data));
      }
    } else if (request.type === "start-recording-tab") {
      //chrome.storage.local.get(["customRegion"], (result) => {
      //if (result.customRegion) {
      if (regionRef.current) {
        startRecording();
      }
      //}
      //});
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

  return <div></div>;
};

export default Recorder;
