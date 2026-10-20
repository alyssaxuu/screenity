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
export const canDeferFinalize = ({ hostAllowed, tracks = [] }) => {
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
  return { defer: true, reason: "ok" };
};

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
