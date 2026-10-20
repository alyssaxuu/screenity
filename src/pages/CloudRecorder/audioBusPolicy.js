// What the screen/camera mux should do with the shared audio bus.
// An empty or frozen bus encodes as full length silent AAC, unrecoverable.

// Attach only when something is actually connected. A separated take keeps
// the mic off the bus, and system audio can be requested but never granted.
//
// Takes busSources ({ mic, system }) itself. 4.6.9 destructured
// { busHasMic, busHasSystem } while both callers passed busSources.current, so
// it read two absent keys, always returned false, and every Pro recording lost
// its system audio.
export const shouldMuxBusAudio = ({ mic = false, system = false } = {}) =>
  Boolean(mic || system);

// A suspended AudioContext feeds its MediaStreamDestination digital silence.
// Pause suspends it on purpose, so only resume when we are not paused.
export const needsContextResume = ({ state, paused = false } = {}) =>
  state === "suspended" && !paused;

// After pause suspended the graph and restart tore the take down, the old
// source nodes can keep feeding zeros once it resumes, while a fresh node on
// the same live track carries signal. Swap each for a fresh one into the same
// gain. The fresh node is connected before the old one is dropped, and a
// failure keeps the old node rather than leaving the gain without a source.
export const rebuildBusSources = ({ ctx, sources = {}, gains = {} } = {}) => {
  const next = { ...sources };
  for (const key of ["mic", "system"]) {
    const old = sources[key];
    const gain = gains[key];
    if (!ctx || !old?.mediaStream || !gain) continue;
    let fresh = null;
    try {
      fresh = ctx.createMediaStreamSource(old.mediaStream);
      fresh.connect(gain);
    } catch {
      try {
        fresh?.disconnect();
      } catch {}
      continue;
    }
    try {
      old.disconnect();
    } catch {}
    next[key] = fresh;
  }
  return next;
};

// Below this the bus is digital silence rather than a quiet room. Measured
// against float samples, so it sits far under any real noise floor.
export const BUS_SILENCE_RMS = 1e-5;

// Silent bus while the user asked for a mic and a live mic track exists.
// That combination is always a fault, never a quiet speaker.
export const isBusSilentFault = ({
  rms = null,
  micIntended = false,
  hasLiveMicTrack = false,
} = {}) =>
  typeof rms === "number" &&
  rms < BUS_SILENCE_RMS &&
  micIntended &&
  hasLiveMicTrack;
