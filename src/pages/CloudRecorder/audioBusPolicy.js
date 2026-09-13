// What the screen/camera mux should do with the shared audio bus.
// An empty or frozen bus encodes as full length silent AAC, unrecoverable.

// Attach only when something is actually connected. A separated take keeps
// the mic off the bus, and system audio can be requested but never granted.
export const shouldMuxBusAudio = ({
  busHasMic = false,
  busHasSystem = false,
} = {}) => Boolean(busHasMic || busHasSystem);

// A suspended AudioContext feeds its MediaStreamDestination digital silence.
// Pause suspends it on purpose, so only resume when we are not paused.
export const needsContextResume = ({ state, paused = false } = {}) =>
  state === "suspended" && !paused;

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
