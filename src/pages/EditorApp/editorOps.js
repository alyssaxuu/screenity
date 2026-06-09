// In-process editor ops, replacing the old editor.html <-> sandbox.html
// postMessage protocol. `reply` re-emits the same result message shapes the host
// used to post, so ContentState's result handlers fire unchanged.
// Each video op is lazy-loaded to keep the ~630KB mediabunny chunk off mount.
import { fixWebmDurationOffThread } from "../Editor/utils/fixWebmDurationOffThread";

const lazyUtil = (importFn) =>
  (...args) =>
    importFn().then((m) => m.default(...args));
const addAudioToVideo = lazyUtil(() => import("../Editor/utils/addAudioToVideo"));
const convertWebmToMp4 = lazyUtil(() => import("../Editor/utils/convertWebmToMp4"));
const cropVideo = lazyUtil(() => import("../Editor/utils/cropVideo"));
const cutVideo = lazyUtil(() => import("../Editor/utils/cutVideo"));
const muteVideo = lazyUtil(() => import("../Editor/utils/muteVideo"));
const reencodeVideo = lazyUtil(() => import("../Editor/utils/reencodeVideo"));
const toGIF = lazyUtil(() => import("../Editor/utils/toGIF"));
const getFrame = lazyUtil(() => import("../Editor/utils/getFrame"));
const convertMp4ToWebm = lazyUtil(() => import("../Editor/utils/convertMp4ToWebm"));

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
  });

// Viewer mode (editor.html?view=1): playback only, edit ops rejected. WebM
// duration fix still runs (metadata repair, not an edit) for seekability.
const VIEWER_REJECTED_OPS = new Set([
  "add-audio-to-video",
  "base64-to-blob",
  "crop-video",
  "cut-video",
  "mute-video",
  "reencode-video",
  "to-gif",
]);

const runViewerOp = async (message, reply) => {
  if (message.type === "load-ffmpeg") {
    reply({ type: "ffmpeg-load-error", fallback: true });
    return;
  }
  if (message.type === "fix-webm-duration") {
    try {
      const fixed = await fixWebmDurationOffThread(
        message.blob,
        message.durationMs,
      );
      reply({ type: "fix-webm-duration-result", id: message.id, blob: fixed });
    } catch (error) {
      reply({
        type: "fix-webm-duration-result",
        id: message.id,
        error: String(error),
      });
    }
    return;
  }
  if (message.type === "get-frame") {
    // read-only poster grab, safe in viewer; otherwise isFfmpegRunning sticks
    try {
      const blob = await getFrame(null, message.blob, message.time);
      reply({ type: "new-frame", frame: blob });
    } catch (error) {
      reply({ type: "ffmpeg-error", error: String(error), _opId: message._opId });
    }
    return;
  }
  if (VIEWER_REJECTED_OPS.has(message.type)) {
    reply({
      type: "ffmpeg-error",
      error:
        "Processing not available in viewer mode. Please use a modern browser (Chrome 94+) for editing features.",
      _opId: message._opId,
    });
  }
};

// Runs an editor op and emits its result(s) via `reply`. The leading ffmpeg
// instance arg to each op util is vestigial (mediabunny ignores it), always null.
export async function runEditorOp(message, reply, { viewer = false } = {}) {
  if (viewer) return runViewerOp(message, reply);
  try {
    switch (message.type) {
      case "load-ffmpeg":
        reply({ type: "ffmpeg-loaded" });
        break;

      case "fix-webm-duration": {
        try {
          const fixed = await fixWebmDurationOffThread(
            message.blob,
            message.durationMs,
          );
          reply({
            type: "fix-webm-duration-result",
            id: message.id,
            blob: fixed,
          });
        } catch (error) {
          reply({
            type: "fix-webm-duration-result",
            id: message.id,
            error: String(error),
          });
        }
        break;
      }

      case "add-audio-to-video": {
        const blob = await addAudioToVideo(
          null,
          message.blob,
          message.audio,
          message.duration,
          message.volume,
          message.replaceAudio,
          (progress) =>
            reply({
              type: "ffmpeg-progress",
              progress: Math.round(progress * 100),
            }),
        );
        const base64 = await toBase64(blob);
        reply({
          type: "updated-blob",
          base64,
          topLevel: true,
          fromAudio: true,
          skipReencode: true,
          _opId: message._opId,
        });
        break;
      }

      case "base64-to-blob": {
        if (
          typeof message.base64 !== "string" ||
          !message.base64.startsWith("data:")
        ) {
          throw new Error("base64-to-blob: expected data: URL");
        }
        const rawBlob = await fetch(message.base64).then((r) => r.blob());

        const header = await rawBlob.slice(4, 8).text();
        const looksMp4 = header === "ftyp";

        if (looksMp4) {
          reply({
            type: "updated-blob",
            base64: message.base64,
            topLevel: true,
          });
          break;
        }

        // reuse the already-decoded rawBlob; mediabunny sniffs the container
        // from bytes, so no second base64 decode is needed
        const mp4Blob = await convertWebmToMp4(rawBlob, (progress) =>
          reply({
            type: "ffmpeg-progress",
            progress: Math.round(progress * 100),
          }),
        );

        const base64 = await toBase64(mp4Blob);
        reply({ type: "updated-blob", base64, topLevel: true });
        break;
      }

      case "crop-video": {
        const blob = await cropVideo(
          null,
          message.blob,
          {
            x: message.x,
            y: message.y,
            width: message.width,
            height: message.height,
          },
          (progress) => reply({ type: "ffmpeg-progress", progress }),
        );
        const base64 = await toBase64(blob);
        reply({
          type: "updated-blob",
          base64,
          topLevel: true,
          _opId: message._opId,
        });
        break;
      }

      case "cut-video": {
        const blob = await cutVideo(
          null,
          message.blob,
          message.startTime,
          message.endTime,
          message.cut,
          message.duration,
          message.encode,
          (progress) => reply({ type: "ffmpeg-progress", progress }),
        );
        const base64 = await toBase64(blob);
        reply({
          type: "updated-blob",
          base64,
          addToHistory: true,
          topLevel: true,
          _opId: message._opId,
        });
        break;
      }

      case "get-frame": {
        const blob = await getFrame(null, message.blob, message.time);
        reply({ type: "new-frame", frame: blob });
        break;
      }

      case "mute-video": {
        const blob = await muteVideo(
          null,
          message.blob,
          message.startTime,
          message.endTime,
          message.duration,
          (progress) => reply({ type: "ffmpeg-progress", progress }),
        );
        const base64 = await toBase64(blob);
        reply({
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
          null,
          message.blob,
          message.duration,
          (progress) =>
            reply({
              type: "ffmpeg-progress",
              progress: Math.round(progress * 100),
            }),
        );
        const base64 = await toBase64(blob);
        reply({
          type: "updated-blob",
          base64,
          topLevel: true,
          _opId: message._opId,
        });
        break;
      }

      case "to-gif": {
        const blob = await toGIF(null, message.blob);
        const base64 = await toBase64(blob);
        reply({ type: "download-gif", base64 });
        break;
      }

      case "to-webm": {
        if (message.blob?.type === "video/webm") {
          const base64 = await toBase64(message.blob);
          reply({ type: "download-webm", base64 });
          break;
        }

        const result = await convertMp4ToWebm(message.blob, (progress) =>
          reply({
            type: "ffmpeg-progress",
            progress: Math.round(progress * 100),
          }),
        );

        const base64 = await toBase64(result);
        reply({ type: "download-webm", base64 });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : null;
    // Error props are non-enumerable; JSON.stringify drops them.
    console.error("[Screenity][Editor] op failed", {
      type: message.type,
      message: errMsg,
      stack: errStack,
      opId: message._opId,
    });
    if (errMsg.includes("too long")) {
      reply({ type: "edit-too-long", _opId: message._opId });
    } else if (errMsg.includes("background-audio-too-large")) {
      reply({ type: "audio-too-large", _opId: message._opId });
    } else {
      reply({
        type: "ffmpeg-error",
        error: errMsg || "unknown",
        errorStack: errStack,
        errorMessage: errMsg,
        opType: message.type,
        _opId: message._opId,
      });
    }
  }
}
