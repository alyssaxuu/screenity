import React, { useEffect, useRef } from "react";

// Lazy-load each video op so editorwebcodecs.html mounts without
// pulling the ~630KB mediabunny chunk until the user invokes one.
const lazyUtil = (importFn) =>
  (...args) =>
    importFn().then((m) => m.default(...args));
const addAudioToVideo = lazyUtil(() => import("./utils/addAudioToVideo"));
const convertWebmToMp4 = lazyUtil(() => import("./utils/convertWebmToMp4"));
const cropVideo = lazyUtil(() => import("./utils/cropVideo"));
const cutVideo = lazyUtil(() => import("./utils/cutVideo"));
const muteVideo = lazyUtil(() => import("./utils/muteVideo"));
const reencodeVideo = lazyUtil(() => import("./utils/reencodeVideo"));
const toGIF = lazyUtil(() => import("./utils/toGIF"));
const getFrame = lazyUtil(() => import("./utils/getFrame"));
const hasAudio = lazyUtil(() => import("./utils/hasAudio"));
const convertMp4ToWebm = lazyUtil(() => import("./utils/convertMp4ToWebm"));
const blobToArrayBuffer = lazyUtil(() => import("./utils/blobToArrayBuffer"));

const Sandbox = () => {
  const iframeRef = useRef(null);
  const triggerLoad = useRef(false);
  const ffmpegInstance = useRef(null);
  const mediabunnyLoaded = useRef(false);

  const sendMessage = (message) => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  };

  const loadFfmpeg = async () => {
    if (mediabunnyLoaded.current || !triggerLoad.current) return;
    try {
      mediabunnyLoaded.current = true;
      sendMessage({ type: "ffmpeg-loaded" });
    } catch (error) {
      sendMessage({
        type: "ffmpeg-load-error",
        error: JSON.stringify(error),
        fallback: true,
      });
    }
  };

  function isMp4Blob(blob) {
    return blob
      .slice(4, 8)
      .text()
      .then((t) => t === "ftyp");
  }

  const toBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
    });

  const base64ToWebmBlob = (base64) => {
    const dataURLRegex = /^data:.+;base64,/;
    if (dataURLRegex.test(base64)) base64 = base64.replace(dataURLRegex, "");
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: "video/webm" });
  };

  const onMessage = async (message) => {
    try {
      switch (message.type) {
        case "load-ffmpeg":
          triggerLoad.current = true;
          await loadFfmpeg();
          break;

        case "add-audio-to-video": {
          const blob = await addAudioToVideo(
            ffmpegInstance.current,
            message.blob,
            message.audio,
            message.duration,
            message.volume,
            message.replaceAudio,
            (progress) =>
              sendMessage({
                type: "ffmpeg-progress",
                progress: Math.round(progress * 100),
              })
          );
          const base64 = await toBase64(blob);
          sendMessage({
            type: "updated-blob",
            base64,
            topLevel: true,
            fromAudio: true,
            skipReencode: true,
            _opId: message._opId,
          });
          break;
        }

        case "compress-video": {
          if (typeof message.base64 !== "string" || !message.base64.startsWith("data:")) {
            throw new Error("compress-video: expected data: URL");
          }
          const rawBlob = await fetch(message.base64).then((r) => r.blob());

          const compressed = await reencodeVideo(
            ffmpegInstance.current,
            rawBlob,
            null,
            (progress) =>
              sendMessage({
                type: "compression-progress",
                progress: Math.round(progress * 100),
              })
          );
          const base64 = await toBase64(compressed);
          sendMessage({
            type: "updated-blob",
            base64,
            topLevel: true,
            _opId: message._opId,
          });
          break;
        }

        case "base64-to-blob": {
          if (typeof message.base64 !== "string" || !message.base64.startsWith("data:")) {
            throw new Error("base64-to-blob: expected data: URL");
          }
          const rawBlob = await fetch(message.base64).then((r) => r.blob());

          const header = await rawBlob.slice(4, 8).text();
          const looksMp4 = header === "ftyp";

          if (looksMp4) {
            sendMessage({
              type: "updated-blob",
              base64: message.base64,
              topLevel: true,
            });
            break;
          }

          const webmBlob = base64ToWebmBlob(message.base64);
          const mp4Blob = await convertWebmToMp4(webmBlob, (progress) =>
            sendMessage({
              type: "ffmpeg-progress",
              progress: Math.round(progress * 100),
            })
          );

          const base64 = await toBase64(mp4Blob);
          sendMessage({ type: "updated-blob", base64, topLevel: true });
          break;
        }

        case "blob-to-array-buffer": {
          const arrayBuffer = await blobToArrayBuffer(
            ffmpegInstance.current,
            message.blob
          );
          sendMessage({ type: "updated-array-buffer", arrayBuffer });
          break;
        }

        case "crop-video": {
          const blob = await cropVideo(
            ffmpegInstance.current,
            message.blob,
            {
              x: message.x,
              y: message.y,
              width: message.width,
              height: message.height,
            },
            (progress) => sendMessage({ type: "ffmpeg-progress", progress })
          );
          const base64 = await toBase64(blob);
          sendMessage({ type: "updated-blob", base64, topLevel: true, _opId: message._opId });
          break;
        }

        case "cut-video": {
          const blob = await cutVideo(
            ffmpegInstance.current,
            message.blob,
            message.startTime,
            message.endTime,
            message.cut,
            message.duration,
            message.encode,
            (progress) => sendMessage({ type: "ffmpeg-progress", progress })
          );
          const base64 = await toBase64(blob);
          sendMessage({
            type: "updated-blob",
            base64,
            addToHistory: true,
            topLevel: true,
            _opId: message._opId,
          });
          break;
        }

        case "get-frame": {
          const blob = await getFrame(
            ffmpegInstance.current,
            message.blob,
            message.time
          );
          sendMessage({ type: "new-frame", frame: blob });
          break;
        }

        case "has-audio": {
          const audio = await hasAudio(ffmpegInstance.current, message.video);
          sendMessage({ type: "updated-has-audio", hasAudio: audio });
          break;
        }

        case "mute-video": {
          const blob = await muteVideo(
            ffmpegInstance.current,
            message.blob,
            message.startTime,
            message.endTime,
            message.duration,
            (progress) => sendMessage({ type: "ffmpeg-progress", progress })
          );
          const base64 = await toBase64(blob);
          sendMessage({
            type: "updated-blob",
            base64,
            addToHistory: true,
            topLevel: true,
            _opId: message._opId,
          });
          break;
        }

        case "reencode-video": {
          const blob = await reencodeVideo(
            ffmpegInstance.current,
            message.blob,
            message.duration,
            (progress) =>
              sendMessage({
                type: "ffmpeg-progress",
                progress: Math.round(progress * 100),
              })
          );
          const base64 = await toBase64(blob);
          sendMessage({ type: "updated-blob", base64, topLevel: true, _opId: message._opId });
          break;
        }

        case "to-gif": {
          const blob = await toGIF(ffmpegInstance.current, message.blob);
          const base64 = await toBase64(blob);
          sendMessage({ type: "download-gif", base64 });
          break;
        }

        case "to-webm": {
          if (message.blob?.type === "video/webm") {
            const base64 = await toBase64(message.blob);
            sendMessage({ type: "download-webm", base64 });
            return;
          }

          const result = await convertMp4ToWebm(message.blob, (progress) =>
            sendMessage({
              type: "ffmpeg-progress",
              progress: Math.round(progress * 100),
            })
          );

          const base64 = await toBase64(result);
          sendMessage({ type: "download-webm", base64 });
          break;
        }

        default:
          break;
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : null;
      // Error props are non-enumerable; JSON.stringify drops them.
      console.error("[Screenity][EditorWebCodecs] op failed", {
        type: message.type,
        message: errMsg,
        stack: errStack,
        opId: message._opId,
      });
      if (errMsg.includes("too long")) {
        sendMessage({ type: "edit-too-long", _opId: message._opId });
      } else if (errMsg.includes("background-audio-too-large")) {
        sendMessage({ type: "audio-too-large", _opId: message._opId });
      } else {
        sendMessage({
          type: "ffmpeg-error",
          error: errMsg || "unknown",
          errorStack: errStack,
          errorMessage: errMsg,
          opType: message.type,
          _opId: message._opId,
        });
      }
    }
  };

  useEffect(() => {
    const handler = (event) => onMessage(event.data);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Bridge editor-force-close from BG to the sandboxed iframe via
  // postMessage; sandbox.html has no chrome.runtime access. Also
  // clear the parent's beforeunload if set.
  useEffect(() => {
    const onRuntimeMessage = (message, _sender, sendResponse) => {
      if (message?.type !== "editor-force-close") return;
      try {
        window.onbeforeunload = null;
      } catch {}
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "editor-force-close" },
          "*",
        );
      } catch {}
      try {
        sendResponse?.({ ok: true });
      } catch {}
    };
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
    return () => chrome.runtime.onMessage.removeListener(onRuntimeMessage);
  }, []);

  useEffect(() => {
    const storageHandler = (changes, areaName) => {
      if (areaName !== "local") return;
      if (!changes.editorRecordingError) return;
      const payload = changes.editorRecordingError.newValue;
      if (!payload) return;
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "recording-error-from-parent", payload },
          "*",
        );
      } catch {}
    };
    chrome.storage.onChanged.addListener(storageHandler);
    const respondWithLatest = () => {
      chrome.storage.local.get(["editorRecordingError"]).then((res) => {
        if (!res?.editorRecordingError) return;
        try {
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "recording-error-from-parent",
              payload: res.editorRecordingError,
            },
            "*",
          );
        } catch {}
      });
    };
    const requestHandler = (event) => {
      if (event?.data?.type === "request-recording-error-state") {
        respondWithLatest();
      }
    };
    window.addEventListener("message", requestHandler);
    respondWithLatest();
    return () => {
      chrome.storage.onChanged.removeListener(storageHandler);
      window.removeEventListener("message", requestHandler);
    };
  }, []);

  return (
    <div>
      <iframe
        ref={iframeRef}
        src={`sandbox.html${window.location.search || ""}`}
        allowFullScreen
        style={{
          width: "100%",
          border: "none",
          height: "100vh",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
};

export default Sandbox;
