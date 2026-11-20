// How much of a cloud recording stays on disk while it uploads, and what the
// editor can play meanwhile. The scene is created before the upload, so its URL
// 404s until upload completes and local chunks cover that window.
// Pure functions, no browser deps, so tests/unit can exercise them.

// Below this headroom, shrink the retained prefix. ~8x the low-space warning
// (250MB) and ~17x the stop threshold (120MB).
export const CHUNK_PURGE_COMFORT_HEADROOM_BYTES = 2 * 1024 * 1024 * 1024;
// Prefix budget under pressure: worth playing, small enough not to matter on a
// tight disk.
export const LOCAL_PLAYBACK_PREFIX_PRESSURE_BYTES = 64 * 1024 * 1024;

const headroomKnown = (headroom) =>
  typeof headroom === "number" && Number.isFinite(headroom) && headroom > 0;

// Unknown estimate counts as pressure but not as tight disk. Headroom is null
// until the first async estimate, exactly when chunk_0 arrives, and a prefix
// missing chunk_0 never becomes contiguous.
const headroomIsBelow = (headroom, bar) =>
  headroomKnown(headroom) ? headroom < bar : false;

// Ceiling is the TRANSPORT cap: the base64 runtime loop refuses past
// LOCAL_SCREEN_PLAYBACK_MAX_BYTES. Passed in so the Blob handoff can raise it
// in one place.
export const resolvePrefixBudget = ({
  headroom,
  transportCapBytes,
  pressureBytes = LOCAL_PLAYBACK_PREFIX_PRESSURE_BYTES,
  comfortBytes = CHUNK_PURGE_COMFORT_HEADROOM_BYTES,
  lowBytes,
}) => {
  if (typeof lowBytes === "number" && headroomIsBelow(headroom, lowBytes)) {
    return 0;
  }
  if (!headroomKnown(headroom) || headroomIsBelow(headroom, comfortBytes)) {
    return Math.min(pressureBytes, transportCapBytes);
  }
  return transportCapBytes;
};

// Mid-recording, chunks the server has acknowledged are deleted only while the
// disk is known to be short. Everything else waits for Bunny to confirm the take
// (the two-point rule), and an unknown estimate keeps everything.
export const mayPurgeAcknowledgedChunks = ({
  headroom,
  comfortBytes = CHUNK_PURGE_COMFORT_HEADROOM_BYTES,
}) => headroomKnown(headroom) && headroom < comfortBytes;

// "trailing" spares the leading prefix, "all" purges it too. No keep-everything
// mode: quota-based headroom never lapses on a roomy disk, so the prefix budget
// is the real bound.
export const resolvePurgeMode = ({ headroom, lowBytes }) =>
  typeof lowBytes === "number" && headroomIsBelow(headroom, lowBytes)
    ? "all"
    : "trailing";

export const emptyRetainedPrefix = () => ({
  chunks: 0,
  bytes: 0,
  dropped: false,
  endBytes: [],
});

// `endByte` is the uploader's running total, the same byte stream the editor plays.
// Once a chunk leaves the tracked ranges this is the only record of what the server has.
export const extendRetainedPrefix = (
  prefix,
  { index, endByte, budgetBytes },
) => {
  if (prefix.dropped) return prefix;
  if (prefix.chunks !== index) return prefix;
  if (!(endByte > 0) || endByte > budgetBytes) return prefix;
  return {
    ...prefix,
    chunks: index + 1,
    bytes: endByte,
    endBytes: [...(prefix.endBytes || []), endByte],
  };
};

// Same cutoff the trailing purge uses. The prefix grows when a chunk reaches the
// uploader, so dropping all of it deletes the only copy of bytes still in flight.
export const selectPrefixChunksToDrop = ({
  prefix,
  lastServerOffset,
  safetyWindowBytes,
}) => {
  const empty = { drop: [], bytes: 0, keptUnconfirmed: 0 };
  if (!prefix || prefix.dropped || prefix.chunks <= 1) return empty;
  const endBytes = prefix.endBytes || [];
  const cutoff = (Number(lastServerOffset) || 0) - safetyWindowBytes;
  if (!(cutoff > 0)) return { ...empty, keptUnconfirmed: prefix.chunks - 1 };

  const drop = [];
  let bytes = 0;
  // chunk_0 is the init segment and never goes. Stop at the first unconfirmed
  // chunk: the prefix is contiguous, so everything after it is unconfirmed too.
  for (let i = 1; i < prefix.chunks; i += 1) {
    const endByte = endBytes[i];
    // No recorded endByte means it predates tracking, so treat as unconfirmed.
    if (!(endByte > 0) || endByte > cutoff) break;
    drop.push(i);
    bytes += endByte - (endBytes[i - 1] || 0);
  }
  return { drop, bytes, keptUnconfirmed: prefix.chunks - 1 - drop.length };
};

export const shouldRetainChunk = (index, prefixChunks) =>
  index === 0 || index < prefixChunks;

// Both sets stop being tracked, only `purge` leaves disk. Ranges are ascending and
// consumed from the front, so the retained set stays contiguous from chunk_0.
export const selectChunksToPurge = ({
  ranges,
  lastServerOffset,
  safetyWindowBytes,
  prefixChunks,
}) => {
  const empty = { purge: [], untrack: [] };
  if (!ranges?.length) return empty;
  if (!(lastServerOffset > safetyWindowBytes)) return empty;
  const cutoff = lastServerOffset - safetyWindowBytes;
  const purge = [];
  const untrack = [];
  for (const entry of ranges) {
    if (entry.endByte > cutoff) break;
    untrack.push(entry);
    if (!shouldRetainChunk(entry.index, prefixChunks)) purge.push(entry);
  }
  return { purge, untrack };
};

// Whole recording, retained opening, or nothing. Purging alone doesn't
// disqualify an offer.
export const resolveLocalPlaybackPlan = ({
  purged,
  prefix,
  totalBytes,
  storeChunkCount,
  maxBytes,
}) => {
  if (
    !purged &&
    totalBytes > 0 &&
    totalBytes <= maxBytes &&
    storeChunkCount > 0
  ) {
    return {
      chunkCount: storeChunkCount,
      availableBytes: totalBytes,
      partial: false,
    };
  }

  // Needs the init segment plus at least one media chunk to decode.
  if (
    prefix &&
    !prefix.dropped &&
    prefix.chunks >= 2 &&
    prefix.bytes > 0 &&
    prefix.bytes <= maxBytes &&
    storeChunkCount >= 2
  ) {
    return {
      chunkCount: Math.min(prefix.chunks, storeChunkCount),
      availableBytes: prefix.bytes,
      partial: true,
    };
  }

  return {
    chunkCount: 0,
    availableBytes: 0,
    partial: false,
    reason: prefix?.dropped
      ? "prefix-dropped-storage-pressure"
      : purged
        ? "no-retained-prefix"
        : "source-too-large",
  };
};

// A take still uploading from its OPFS copy (draining, parked, waiting on Bunny, held) has nothing
// else on disk, so a copy going away must not take it along. "stopping" is kept whatever started it:
// the offer registers before the deferred finalize and the separated mic's inline upload.
// Crashed, stale-cleared and killed takes keep the folder too (settle judges them).
const OFFER_BYTES_STATUSES = new Set([
  "recording",
  "hidden",
  "unload",
  "upload-stalled",
  "finalize-failed",
  "awaiting-confirm",
  "crashed",
  "stale-cleared",
]);

export const sessionKeepsOfferBytes = (session) => {
  if (!session || typeof session !== "object") return false;
  if (session.discardedAt) return false;
  if (session.holdUntilRecovered === true) return true;
  if (session.status === "stopping") return true;
  return OFFER_BYTES_STATUSES.has(session.status);
};

// An IDB offer points at the shared store, which may hold the only copy of an unconfirmed take
// (an upload-stalled one), so the same rule applies. The next start does not clear a store such a take owns.
const sessionKeepsIdbOfferBytes = sessionKeepsOfferBytes;

// Drops the bytes an offer points at, unless the take they belong to still
// needs them. A snapshot that cannot be read keeps the bytes: nothing here may
// delete what it cannot prove is spare.
export const clearOfferBytes = async ({
  offer,
  readSession,
  clearStore,
  destroyDir,
}) => {
  // No stored offer proves nothing about whose bytes the shared store holds
  // (an expired offer leaves a take awaiting Bunny with no record here).
  if (!offer) return { kept: true };
  const opfs = offer?.storageBackend === "opfs" && Boolean(offer?.opfsSessionId);
  if (opfs) {
    const sessionId = offer.recordingSessionId || offer.opfsSessionId;
    try {
      if (sessionKeepsOfferBytes(await readSession(sessionId))) {
        return { kept: true };
      }
    } catch {
      return { kept: true };
    }
  }
  if (!opfs) {
    const sessionId = offer?.recordingSessionId || null;
    if (sessionId) {
      try {
        if (sessionKeepsIdbOfferBytes(await readSession(sessionId))) {
          return { kept: true };
        }
      } catch {
        return { kept: true };
      }
    }
  }
  await clearStore();
  if (opfs) await destroyDir(offer.opfsSessionId);
  return { kept: false };
};

// At completion the folder stays only for an offer the editor can still collect (this document's,
// unexpired): the expiry timer drops a stored offer mid-upload, and Stop's in-memory copy would
// keep the folder with nothing left to clear it.
export const offerStillCollectable = (stored, mine, now = Date.now()) =>
  Boolean(mine?.offerId) &&
  stored?.offerId === mine.offerId &&
  Number(stored.expiresAt || 0) > now;
