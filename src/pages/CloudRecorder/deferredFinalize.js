// Whether Stop can create the scene before the video uploaders finish closing
// their TUS resources, and what may happen to a track once that close settles.
// Pure functions, no browser deps, so tests/unit can exercise them.

export const VIDEO_TRACKS = ["screen", "camera"];

// Only an OPFS copy counts: it lives in this session's own directory, while the
// IDB stores are shared and the next take's start clears them.
export const isFullDurableCopy = (durable) =>
  Boolean(durable) &&
  durable.backend === "opfs" &&
  durable.storeReady === true &&
  durable.writeFailed !== true &&
  Number(durable.purgedChunks) === 0 &&
  Number(durable.durableChunkCount) > 0;

export const describeTrack = (track, uploader, durable = null) => ({
  track,
  present: Boolean(uploader),
  uploadUrl: uploader?.uploadUrl || null,
  mediaId: uploader?.mediaId || null,
  videoId: uploader?.videoId || null,
  offset: Number(uploader?.offset) || 0,
  status: uploader?.status || null,
  stillClosing: isStillClosing(uploader),
  durable,
});

// Read off the live uploader, never a saved meta snapshot: the snapshot taken at
// Stop says "uploading" for a track whose close is still in flight.
export const isStillClosing = (uploader) =>
  Boolean(uploader) &&
  (uploader.isFinalizing === true || uploader.status === "finalizing");

// All or nothing: one track that can't be recovered keeps the blocking join.
// takeShort means the upload is behind the take. Such a take is finished from its own OPFS copy after
// Stop ("drain") only when every own-bytes track can be re-read from disk, the mic's upload too.
export const canDeferFinalize = ({
  hostAllowed,
  tracks = [],
  takeShort = false,
  audio = null,
}) => {
  if (!hostAllowed) return { defer: false, reason: "host" };
  const present = tracks.filter((t) => t?.present);
  if (!present.length) return { defer: false, reason: "no-video-tracks" };
  for (const t of present) {
    if (!t.uploadUrl || !t.mediaId || !t.videoId) {
      return { defer: false, reason: `${t.track}-no-tus-resource` };
    }
    if (!(t.offset > 0)) return { defer: false, reason: `${t.track}-no-bytes` };
    if (t.status === "error" || t.status === "aborted") {
      return { defer: false, reason: `${t.track}-${t.status}` };
    }
    if (!isFullDurableCopy(t.durable)) {
      return { defer: false, reason: `${t.track}-no-full-local-copy` };
    }
  }
  if (takeShort) {
    if (audio?.present && !isFullDurableCopy(audio.durable)) {
      return { defer: false, reason: "audio-no-full-local-copy" };
    }
    return { defer: true, reason: "ok", drain: true };
  }
  return { defer: true, reason: "ok" };
};

// No offset progress for this long means the link is dead: today's failure
// path (modal, recovery file) takes over instead of draining forever.
export const DRAIN_NO_PROGRESS_MS = 10 * 60 * 1000;
export const DRAIN_RETRY_PAUSE_MS = 5000;

// Re-sends what the server is missing from the local copy until level, then closes the upload. A park
// (the next recording starting) ends it quietly, bytes and journal kept. Never rejects for a park.
export const runDrain = async ({
  shortBy,
  getOffset,
  resend,
  finalize,
  isParked,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  noProgressMs = DRAIN_NO_PROGRESS_MS,
  pauseMs = DRAIN_RETRY_PAUSE_MS,
}) => {
  let seenOffset = getOffset();
  let seenAt = now();
  while (shortBy() > 0) {
    if (isParked()) return { outcome: "parked" };
    await resend();
    if (isParked()) return { outcome: "parked" };
    const offset = getOffset();
    if (offset > seenOffset) {
      seenOffset = offset;
      seenAt = now();
    }
    if (shortBy() <= 0) break;
    if (now() - seenAt >= noProgressMs) throw new Error("drain-no-progress");
    await sleep(pauseMs);
  }
  if (isParked()) return { outcome: "parked" };
  try {
    await finalize();
  } catch (err) {
    // Standing down aborts the closing PATCH; that is the park, not a failure.
    if (isParked()) return { outcome: "parked" };
    throw err;
  }
  return { outcome: "finalized" };
};

// Only the next recording's start parks, and only a take that is draining.
// Discard, update and explicit flushes keep their existing handling.
export const shouldParkForNextTake = ({
  reason,
  shouldFinalize = true,
  drainActive = false,
}) =>
  reason === "new-recording-start" && shouldFinalize !== false && drainActive === true;

// Resolves with the allSettled results and never rejects.
export const createFinalizeSettle = (calls = []) => {
  let settled = false;
  const promise = Promise.allSettled(calls).then((results) => {
    settled = true;
    return results;
  });
  return { promise, isSettled: () => settled };
};

export const evaluateFinalizeSettle = ({
  settledResults = [],
  tracks = [],
}) => {
  const rejected = settledResults.filter(
    (r) => r?.status === "rejected"
  ).length;
  const closing = [];
  const incomplete = [];
  for (const t of tracks) {
    if (!t?.present) continue;
    if (t.stillClosing) closing.push(t.track);
    else if (t.status !== "completed") incomplete.push(t.track);
  }
  return {
    complete: rejected === 0 && !closing.length && !incomplete.length,
    rejected,
    closing,
    incomplete,
  };
};

// "resend" re-sends only bytes past the server's offset, read from the full
// local copy. Nothing ever aborts or re-sends a track that is still closing.
export const planFinalizeRetry = (tracks = []) =>
  tracks
    .filter((t) => t?.present)
    .map((t) => {
      if (t.stillClosing) return { track: t.track, action: "wait" };
      if (t.status === "completed" || t.status === "aborted") {
        return { track: t.track, action: "none" };
      }
      if (isFullDurableCopy(t.durable)) {
        return { track: t.track, action: "resend-and-finalize" };
      }
      return {
        track: t.track,
        action: "finalize-only",
        warning: "no-full-local-copy",
      };
    });

// The local copy is the only thing a failed close can be recovered from.
export const canReapLocalCopy = ({ deferred, settled, complete }) =>
  !deferred || (settled === true && complete === true);
