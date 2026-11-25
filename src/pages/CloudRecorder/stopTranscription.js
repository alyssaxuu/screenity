import { pickVoiceSources } from "./micReconnect.js";

// The queue route writes its input onto the scene as transcriptionSourceMediaId,
// so queueing anything other than what the scene POST named would point the
// scene back at it. A separated take is not queued here: its mic is queued from
// the attach paths once it has landed.
export const stopTranscriptionInput = ({ silent, stopAudio, uploadMeta }) => {
  if (stopAudio?.separated) return null;
  return pickVoiceSources({
    silent,
    separated: false,
    voiceOnBus: Boolean(stopAudio?.voiceOnBus),
    micId: uploadMeta?.audio?.mediaId || null,
    separatedMicId: null,
    busId: uploadMeta?.screen?.mediaId || uploadMeta?.camera?.mediaId || null,
  }).transcriptionSourceMediaId;
};

// The live session is fed from the mic file's chunks, so it can only hand off
// when the scene still transcribes the mic file.
export const liveTapAtStop = ({ shouldFinalize, voiceOnBus }) =>
  shouldFinalize && !voiceOnBus ? "stop" : "cancel";

// Resolves to "queued", "deduped", "skipped" or "failed". Never throws.
export const queueTranscription = async ({
  apiBase,
  projectId,
  sceneId,
  inputMediaId,
  targetMediaId,
  storage = chrome.storage.local,
  fetchImpl = (...args) => fetch(...args),
  log = () => {},
}) => {
  if (!inputMediaId || !targetMediaId) return "skipped";
  try {
    const dedupeKey = `transcriptionQueued:${sceneId}:${inputMediaId}`;
    const dedupe = await storage.get([dedupeKey]);
    if (dedupe?.[dedupeKey]) return "deduped";

    const { screenityToken } = await storage.get(["screenityToken"]);
    const res = await fetchImpl(`${apiBase}/transcription/queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(screenityToken ? { Authorization: `Bearer ${screenityToken}` } : {}),
      },
      credentials: "include",
      // Fired un-awaited just before the tab closes, and a plain fetch is
      // cancelled with the document.
      keepalive: true,
      body: JSON.stringify({
        output: `transcriptions/${inputMediaId}.json`,
        videoId: projectId,
        sceneId,
        inputMediaId,
        targetMediaId,
        model: "tiny",
      }),
    });
    log("transcription-queued", { projectId, sceneId, inputMediaId, targetMediaId });
    // Only a queued job dedupes; a failed call must stay retryable.
    if (!res?.ok) return "failed";
    await storage.set({ [dedupeKey]: true });
    return "queued";
  } catch (err) {
    console.warn("Transcription queue failed:", err);
    log("transcription-failed", {
      projectId,
      sceneId,
      error: err?.message || String(err),
    });
    return "failed";
  }
};

// Right after the scene POST, with the same stop verdict it used. afterClose is
// the deferred close of the video uploads (null when they closed before the
// POST), resolving true once complete. The bus file is one of those uploads and
// the worker fetches it at once, so it waits; the mic file was closed before
// the POST. A close that fails, parks or outlives this document queues nothing
// here: the scene was created waiting on the bus file, and the server queues it
// when Bunny reports that file ready.
export const queueStopTranscription = async ({
  silent,
  stopAudio,
  uploadMeta,
  afterClose = null,
  ...rest
}) => {
  const inputMediaId = stopTranscriptionInput({ silent, stopAudio, uploadMeta });
  const busId = uploadMeta?.screen?.mediaId || uploadMeta?.camera?.mediaId || null;
  if (!inputMediaId) return "skipped";
  if (afterClose && inputMediaId === busId && !(await afterClose)) {
    return "left-to-server";
  }
  return queueTranscription({
    ...rest,
    inputMediaId,
    targetMediaId: busId,
  });
};
