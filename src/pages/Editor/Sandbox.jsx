import React, { useEffect, useRef } from "react";

// Import all the utils
import addAudioToVideo from "./utils/addAudioToVideo";
import base64ToBlob from "./utils/base64toBlob";
import blobToArrayBuffer from "./utils/blobToArrayBuffer";
import cropVideo from "./utils/cropVideo";
import cutVideo from "./utils/cutVideo";
import fetchFile from "./utils/fetchFile";
import generateThumbstrips from "./utils/generateThumbstrips";
import getAudio from "./utils/getAudio";
import getFrame from "./utils/getFrame";
import hasAudio from "./utils/hasAudio";
import muteVideo from "./utils/muteVideo";
import reencodeVideo from "./utils/reencodeVideo";
import toGIF from "./utils/toGIF";

const Sandbox = () => {
  const iframeRef = useRef(null);
  const scriptLoaded = useRef(false);
  const triggerLoad = useRef(false);
  const ffmpegInstance = useRef(null);

  const sendMessage = (message) => {
    iframeRef.current.contentWindow.postMessage(message, "*");
  };

  const loadFfmpeg = async () => {
    if (!scriptLoaded.current) return;
    if (!triggerLoad.current) return;
    if (ffmpegInstance.current) return;

    try {
      const { createFFmpeg } = FFmpeg;
      // Initialize ffmpeg.js
      ffmpegInstance.current = createFFmpeg({
        log: false,
        progress: (params) => {},
        corePath: "assets/vendor/ffmpeg-core.js",
      });
      await ffmpegInstance.current.load();
      sendMessage({ type: "ffmpeg-loaded" });
    } catch (error) {
      sendMessage({
        type: "ffmpeg-load-error",
        error: JSON.stringify(error),
        fallback: false,
      });
    }
  };

  useEffect(() => {
    const script = document.createElement("script");

    script.src = "assets/vendor/ffmpeg.min.js";
    script.async = true;

    // On load, set scriptLoaded to true
    script.onload = () => {
      scriptLoaded.current = true;
      loadFfmpeg();
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const toBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
    });
  };

  const onMessage = async (message) => {
    if (message.type === "load-ffmpeg") {
      triggerLoad.current = true;
      loadFfmpeg();
    } else if (message.type === "add-audio-to-video") {
      try {
        const blob = await addAudioToVideo(
          ffmpegInstance.current,
          message.blob,
          message.audio,
          message.duration,
          message.volume,
          message.replaceAudio
        );
        const base64 = await toBase64(blob);
        sendMessage({ type: "updated-blob", base64: base64 });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "base64-to-blob") {
      try {
        const blob = await base64ToBlob(ffmpegInstance.current, message.base64);
        const base64 = await toBase64(blob);
        sendMessage({ type: "updated-blob", base64: base64 });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "blob-to-array-buffer") {
      try {
        const arrayBuffer = await blobToArrayBuffer(
          ffmpegInstance.current,
          message.blob
        );
        sendMessage({ type: "updated-array-buffer", arrayBuffer: arrayBuffer });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "crop-video") {
      try {
        const blob = await cropVideo(ffmpegInstance.current, message.blob, {
          x: message.x,
          y: message.y,
          width: message.width,
          height: message.height,
        });
        const base64 = await toBase64(blob);
        sendMessage({ type: "updated-blob", base64: base64 });
        sendMessage({ type: "crop-update" });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "cut-video") {
      try {
        const blob = await cutVideo(
          ffmpegInstance.current,
          message.blob,
          message.startTime,
          message.endTime,
          message.cut,
          message.duration,
          message.encode
        );
        const base64 = await toBase64(blob);
        sendMessage({
          type: "updated-blob",
          base64: base64,
          addToHistory: true,
        });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "fetch-file") {
      try {
        const blob = await fetchFile(message.url);
        const base64 = await toBase64(blob);
        sendMessage({ type: "updated-blob", base64: base64 });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "generate-thumbstrips") {
      try {
        const blob = await generateThumbstrips(
          ffmpegInstance.current,
          message.blob
        );
        const base64 = await toBase64(blob);
        sendMessage({ type: "updated-blob", base64: base64 });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "get-audio") {
      try {
        const blob = await getAudio(ffmpegInstance.current, message.video);
        const base64 = await toBase64(blob);
        sendMessage({ type: "updated-blob", base64: base64 });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "get-frame") {
      try {
        const blob = await getFrame(
          ffmpegInstance.current,
          message.blob,
          message.time
        );
        sendMessage({ type: "new-frame", frame: blob });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "has-audio") {
      try {
        const audio = await hasAudio(ffmpegInstance.current, message.video);
        sendMessage({ type: "updated-has-audio", hasAudio: audio });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "mute-video") {
      try {
        const blob = await muteVideo(
          ffmpegInstance.current,
          message.blob,
          message.startTime,
          message.endTime,
          message.duration
        );
        const base64 = await toBase64(blob);
        sendMessage({
          type: "updated-blob",
          base64: base64,
          addToHistory: true,
        });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "reencode-video") {
      try {
        const blob = await reencodeVideo(
          ffmpegInstance.current,
          message.blob,
          message.duration
        );
        const base64 = await toBase64(blob);
        sendMessage({ type: "updated-blob", base64: base64 });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    } else if (message.type === "to-gif") {
      try {
        const blob = await toGIF(ffmpegInstance.current, message.blob);
        const base64 = await toBase64(blob);
        sendMessage({ type: "download-gif", base64: base64 });
      } catch (error) {
        sendMessage({ type: "ffmpeg-error", error: JSON.stringify(error) });
      }
    }
  };

  useEffect(() => {
    window.addEventListener("message", (event) => {
      onMessage(event.data);
    });

    return () => {
      window.removeEventListener("message", (event) => {
        onMessage(event.data);
      });
    };
  }, []);

  return (
    <div>
      <iframe
        ref={iframeRef}
        src="sandbox.html"
        allowFullScreen={true}
        style={{
          width: "100%",
          border: "none",
          height: "100vh",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      ></iframe>
    </div>
  );
};

export default Sandbox;
