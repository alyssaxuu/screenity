// In-process editor ops, replacing the old editor.html <-> sandbox.html
// postMessage protocol. `reply` re-emits the same result message shapes the host
// used to post, so ContentState's result handlers fire unchanged.
// Each video op is lazy-loaded to keep the ~630KB mediabunny chunk off mount.
import { fixWebmDurationOffThread } from "../Editor/utils/fixWebmDurationOffThread";
import { blobHasAudioTrack } from "../utils/hasAudioTrack";

const lazyUtil = (importFn) =>
  (...args) =>
    importFn().then((m) => m.default(...args));
// These ops write MP4 audio, which must be AAC. Linux browsers have none, so
// the wasm encoder is registered here, best-effort.
const lazyMp4Util = (importFn) =>
  async (...args) => {
    try {
      const { ensureAacEncoder } = await import("../utils/aacPolyfill");
      await ensureAacEncoder();
    } catch {}
    const m = await importFn();
    return m.default(...args);
  };
const addAudioToVideo = lazyMp4Util(() =>
  import("../Editor/utils/addAudioToVideo"),
);
const convertWebmToMp4 = lazyMp4Util(() =>
  import("../Editor/utils/convertWebmToMp4"),
);
const cropVideo = lazyMp4Util(() => import("../Editor/utils/cropVideo"));
const cutVideo = lazyMp4Util(() => import("../Editor/utils/cutVideo"));
const muteVideo = lazyMp4Util(() => import("../Editor/utils/muteVideo"));
const reencodeVideo = lazyMp4Util(() =>
  import("../Editor/utils/reencodeVideo"),
);
const toGIF = lazyUtil(() => import("../Editor/utils/toGIF"));
const getFrame = lazyUtil(() => import("../Editor/utils/getFrame"));
const convertMp4ToWebm = lazyUtil(() => import("../Editor/utils/convertMp4ToWebm"));

// Results go back as Blobs. They used to be base64 data URLs, but Chrome caps
// a string at ~536M chars, so readAsDataURL on anything over ~384MiB quietly
// returns "" and the editor swapped the recording for an empty video.
const requireResult = (blob, op) => {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error(`${op}: empty result`);
  }
  return blob;
};

// The mediabunny utils report 0..1; the editor shows 0..100.
const percent = (reply) => (progress) =>
  reply({ type: "ffmpeg-progress", progress: Math.round(progress * 100) });

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
          percent(reply),
        );
        reply({
          type: "updated-blob",
          blob: requireResult(blob, "add-audio-to-video"),
          topLevel: true,
          fromAudio: true,
          skipReencode: true,
          _opId: message._opId,
        });
        break;
      }

      case "base64-to-blob": {
        const rawBlob = message.blob;
        if (!(rawBlob instanceof Blob)) {
          throw new Error("base64-to-blob: expected a Blob");
        }

        const header = await rawBlob.slice(4, 8).text();
        const looksMp4 = header === "ftyp";

        if (looksMp4) {
          reply({ type: "updated-blob", blob: rawBlob, topLevel: true });
          break;
        }

        // A silent MP4 is worse than the WebM it came from, so keep the source
        // when AAC is missing and the recording actually has sound.
        let aacOk = false;
        try {
          const { ensureAacEncoder } = await import("../utils/aacPolyfill");
          aacOk = await ensureAacEncoder();
        } catch {}
        if (!aacOk && (await blobHasAudioTrack(rawBlob))) {
          reply({ type: "updated-blob", blob: rawBlob, topLevel: true });
          break;
        }

        // reuse the already-decoded rawBlob; mediabunny sniffs the container
        // from bytes, so no second base64 decode is needed
        const mp4Blob = await convertWebmToMp4(rawBlob, percent(reply));

        reply({
          type: "updated-blob",
          blob: requireResult(mp4Blob, "base64-to-blob"),
          topLevel: true,
        });
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
          percent(reply),
        );
        reply({
          type: "updated-blob",
          blob: requireResult(blob, "crop-video"),
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
          percent(reply),
        );
        reply({
          type: "updated-blob",
          blob: requireResult(blob, "cut-video"),
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
          percent(reply),
        );
        reply({
          type: "updated-blob",
          blob: requireResult(blob, "mute-video"),
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
          percent(reply),
        );
        reply({
          type: "updated-blob",
          blob: requireResult(blob, "reencode-video"),
          topLevel: true,
          _opId: message._opId,
        });
        break;
      }

      case "to-gif": {
        const blob = await toGIF(null, message.blob);
        reply({ type: "download-gif", blob: requireResult(blob, "to-gif") });
        break;
      }

      case "to-webm": {
        if (message.blob?.type === "video/webm") {
          reply({ type: "download-webm", blob: message.blob });
          break;
        }

        const result = await convertMp4ToWebm(message.blob, percent(reply));

        reply({
          type: "download-webm",
          blob: requireResult(result, "to-webm"),
        });
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
