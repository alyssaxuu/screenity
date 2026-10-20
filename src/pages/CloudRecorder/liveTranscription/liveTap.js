import { LiveAudioSession } from "./liveAudioSession";

// Default ON: only the string "false" disables it. Bare process.env read so
// webpack's DefinePlugin inlines it.
export const isLiveTranscriptionEnabled = () =>
  process.env.ENABLE_LIVE_TRANSCRIPTION !== "false";

const NONE = Object.freeze({ liveSessionId: null });

const isSupportedMime = (mime) => /^audio\/(webm|mp4)/i.test(mime || "");

// Returns null whenever live should not run, so callers do `tap?.push(blob)`.
// Nothing here may throw into the recorder or the upload path.
export const createLiveTap = ({
  enabled = isLiveTranscriptionEnabled(),
  videoId,
  sceneId,
  mime,
  recorderSessionId,
  baseUrl,
  getToken,
  fetch,
  SessionClass = LiveAudioSession,
}) => {
  if (!enabled || !videoId || !sceneId) return null;
  // A base without a scheme (localhost:3000/api) would resolve against the
  // extension origin and every request would miss.
  if (!/^https?:\/\//i.test(baseUrl || "")) return null;
  if (!isSupportedMime(mime)) return null;
  let session;
  try {
    session = new SessionClass({
      videoId: String(videoId),
      sceneId,
      mime,
      recorderSessionId,
      baseUrl,
      getToken,
      fetch,
    });
  } catch {
    return null;
  }
  return {
    push(blob) {
      try {
        session.push(blob);
      } catch {}
    },
    stop() {
      try {
        return Promise.resolve(session.stop()).catch(() => NONE);
      } catch {
        return Promise.resolve(NONE);
      }
    },
    cancel() {
      try {
        session.cancel();
      } catch {}
    },
  };
};

// The seal keeps going in the background if it outlasts ms.
export const waitBounded = (promise, ms = 5000) =>
  new Promise((resolve) => {
    if (!promise) return resolve(NONE);
    const t = setTimeout(() => resolve(NONE), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(NONE);
      }
    );
  });
