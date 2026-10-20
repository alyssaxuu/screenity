// Decides which upload tracks have gone quiet. Split out of CloudRecorder so
// the rule can be tested: upload_track_stalled has never fired in prod.

// mediabunny's fMP4 ftyp is 28 bytes and lands before any encoded packet, so
// an offset this low means the muxer opened and no fragment ever closed.
export const INIT_ONLY_OFFSET = 64;
export const TRACK_STALL_MS = 30000;

// ts null, not 0: a falsy check would read a legitimate epoch-0 stamp as
// "no baseline yet" and never flag the track.
export const createTrackStallState = () => ({
  screen: { offset: -1, ts: null, notified: false },
  camera: { offset: -1, ts: null, notified: false },
  audio: { offset: -1, ts: null, notified: false },
});

const SETTLED = new Set(["completed", "aborted"]);

// Mutates state, returns one report per track that just crossed the threshold.
export const sweepTrackStalls = ({
  state,
  uploaders,
  now,
  stallMs = TRACK_STALL_MS,
  initOnlyOffset = INIT_ONLY_OFFSET,
}) => {
  let anyAdvanced = false;

  for (const [track, uploader] of Object.entries(uploaders)) {
    const entry = state[track];
    if (!entry) continue;
    if (!uploader) {
      entry.offset = -1;
      continue;
    }
    const offset = Number(uploader.offset) || 0;
    if (offset !== entry.offset) {
      entry.offset = offset;
      entry.ts = now;
      entry.notified = false;
      anyAdvanced = true;
    }
  }

  const reports = [];
  for (const [track, uploader] of Object.entries(uploaders)) {
    const entry = state[track];
    if (!entry || !uploader || entry.ts === null || entry.notified) continue;
    if (now - entry.ts <= stallMs) continue;
    if (SETTLED.has(uploader.status)) continue;
    entry.notified = true;
    // The reported failure shape: one track pinned at its init segment while
    // another uploads normally.
    const stuckAtInit = entry.offset > 0 && entry.offset <= initOnlyOffset;
    reports.push({
      track,
      uploader,
      offset: entry.offset,
      stuckAtInit,
      siblingProgressing: anyAdvanced,
      stallMs: now - entry.ts,
    });
  }
  return reports;
};

// Stop-time check: a track whose upload holds only the muxer's init segment.
// `offset` must be the live uploader offset after the final drain, not the
// getMeta() copy taken at stop, which is routinely stale on short takes.
// Fires only when no track carries real media, so a header-only sibling of a
// healthy track is reported as `mixed` and left alone.
export const findHeaderOnlyTracks = (tracks, initOnlyOffset = INIT_ONLY_OFFSET) => {
  const headerOnly = [];
  let carriesMedia = false;
  for (const [track, t] of Object.entries(tracks)) {
    if (!t) continue;
    const offset = Number(t.offset) || 0;
    if (offset === 0) continue;
    const initOnly =
      offset <= initOnlyOffset &&
      (Number(t.queueLength) || 0) === 0 &&
      (Number(t.localBytes) || 0) <= initOnlyOffset;
    if (initOnly) headerOnly.push(track);
    else carriesMedia = true;
  }
  return {
    headerOnly,
    fire: headerOnly.length > 0 && !carriesMedia,
    mixed: headerOnly.length > 0 && carriesMedia,
  };
};
