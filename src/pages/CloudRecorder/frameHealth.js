// Frame delivery numbers for the MediaRecorder path, which has no
// recorder-side counters. Everything here is a number or null.

// Chrome exposes frame counts as `track.stats`. Where missing they stay null
// and the chunk deltas below are the fallback.
export const readTrackFrameStats = (track) => {
  const num = (v) => (Number.isFinite(v) ? v : null);
  let trackStats = null;
  try {
    const st = track?.stats;
    if (st) {
      trackStats = {
        totalFrames: num(st.totalFrames),
        deliveredFrames: num(st.deliveredFrames),
        discardedFrames: num(st.discardedFrames),
      };
    }
  } catch {}
  let frameRateActual = null;
  try {
    frameRateActual = num(track?.getSettings?.().frameRate);
  } catch {}
  return { trackStats, frameRateActual };
};

// Ms from countdown end to a track's first chunk: the head of the take not
// recorded. Null with no countdown, or a stamp left over from an earlier take
// (older than maxAgeMs) or later than the chunk.
export const HEAD_LOSS_MAX_AGE_MS = 10 * 60_000;
export const computeHeadLossMs = (countdownEndAt, firstChunkAt, maxAgeMs = HEAD_LOSS_MAX_AGE_MS) => {
  if (!Number.isFinite(countdownEndAt) || !Number.isFinite(firstChunkAt)) return null;
  const lost = firstChunkAt - countdownEndAt;
  if (lost < 0 || lost > maxAgeMs) return null;
  return Math.round(lost);
};

// Chunks and bytes a track produced since the previous heartbeat, and the ms
// between them (30 s apart after the first ten seconds): a delivery rate where
// the browser reports no frame counts.
export const createChunkDeltas = (now = () => Date.now()) => {
  const prev = {};
  return {
    take(track, chunks, bytes) {
      const t = now();
      const before = prev[track];
      prev[track] = { t, chunks, bytes };
      if (!before) return { hbChunks: null, hbBytes: null, hbMs: null };
      return {
        hbChunks: Math.max(0, chunks - before.chunks),
        hbBytes: Math.max(0, bytes - before.bytes),
        hbMs: t - before.t,
      };
    },
    reset() {
      for (const k of Object.keys(prev)) delete prev[k];
    },
  };
};
