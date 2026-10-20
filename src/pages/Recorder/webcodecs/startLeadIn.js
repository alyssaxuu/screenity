// Shared start epoch for a multi-track take. CloudRecorder takes one
// performance.now() reading and hands it to every WebCodecs video recorder
// that starts after it; each pads its file front so the first frame sits at its
// real offset. Without it a video file's zero is its own first frame, reached
// after an async start chain (probe, muxer, configure) the mic doesn't wait for.
// Tests: tests/unit/startLeadIn.test.mjs

// Anything longer is a broken clock or a stalled start, not a lead-in.
export const MAX_START_LEAD_IN_MS = 10_000;

export const isValidStartEpochMs = (epochMs) =>
  Number.isFinite(epochMs) && epochMs > 0;

// Lead-in in microseconds for media starting at `startUs` (same clock as
// `epochUs`). null = no lead-in (no epoch, negative gap, or past the cap).
export const computeStartLeadInUs = (epochUs, startUs) => {
  if (!Number.isFinite(epochUs) || !Number.isFinite(startUs)) return null;
  const leadInUs = startUs - epochUs;
  if (leadInUs < 0 || leadInUs > MAX_START_LEAD_IN_MS * 1000) return null;
  return leadInUs;
};

export const LEAD_IN_MAX_HELD = 50;

export const createAudioLeadInHoldState = () => ({
  heldUs: 0,
  startUs: null,
  lastReadUs: null,
});

// Packets queued during encoder/muxer start drain in one burst, so read time
// minus the first packet's length over-pads by its queue time. A packet is read
// no earlier than it ends: read time minus everything held bounds the first
// start from above, and the minimum over the run is the estimate. Live once a
// read lands >= half a packet after the previous (queue drained) or at `maxHeld`.
export const advanceAudioLeadInHold = (
  state,
  nowUs,
  packetUs,
  heldCount,
  maxHeld = LEAD_IN_MAX_HELD,
) => {
  state.heldUs += packetUs;
  const startUs = nowUs - state.heldUs;
  if (state.startUs == null || startUs < state.startUs) {
    state.startUs = startUs;
  }
  const live =
    state.lastReadUs != null && nowUs - state.lastReadUs >= packetUs / 2;
  state.lastReadUs = nowUs;
  return live || heldCount >= maxHeld;
};
