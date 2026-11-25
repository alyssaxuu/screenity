// A separated take's mic recorded through its own Web Audio bus: mic source ->
// gain -> MediaStreamDestination, and the mic recorder reads the destination.
// A recorder cannot swap tracks, but the bus can: a mic that drops and comes
// back is plugged into the same gain, the destination fills the gap with
// silence, and the voice stays in one file on the take's timeline.
//
// Off by the disableSeparatedMicBus storage flag (absent = on). Per take it
// also falls back to recording the raw track unless the context runs and the
// bus carries signal when the recorder is built, so a bus that would record
// silence never replaces a working raw recorder.
import { BUS_SILENCE_RMS } from "./audioBusPolicy.js";

export const MIC_BUS_FLAG = "disableSeparatedMicBus";
export const MIC_BUS_SAMPLE_RATE = 48000;

export const micBusDisabled = (stored) => stored?.[MIC_BUS_FLAG] === true;

// The raw recorder encodes the track's own channels; the destination has to
// match or a mono mic turns into duplicated stereo. Unknown means no bus.
export const micTrackChannels = (track) => {
  try {
    const n = track?.getSettings?.()?.channelCount;
    return n === 1 || n === 2 ? n : null;
  } catch {
    return null;
  }
};

const disconnectAll = (nodes) => {
  for (const n of nodes) {
    try {
      n?.disconnect();
    } catch {}
  }
};

// Returns { bus, reason }. bus is null when any precondition fails, and the
// take then records the raw track exactly as before.
export const buildMicFileBus = ({ ctx, stream }) => {
  const track = stream?.getAudioTracks?.()[0] || null;
  if (!ctx || !track) return { bus: null, reason: "no-mic" };
  if (ctx.sampleRate !== MIC_BUS_SAMPLE_RATE) {
    return { bus: null, reason: "sample-rate" };
  }
  const channels = micTrackChannels(track);
  if (!channels) return { bus: null, reason: "channels-unknown" };
  const made = [];
  try {
    const source = ctx.createMediaStreamSource(stream);
    made.push(source);
    const gain = ctx.createGain();
    made.push(gain);
    const dest = ctx.createMediaStreamDestination();
    made.push(dest);
    dest.channelCount = channels;
    source.connect(gain);
    gain.connect(dest);
    // Read once when the recorder is built; never sampled on a timer.
    const tap = ctx.createAnalyser();
    made.push(tap);
    tap.fftSize = 2048;
    gain.connect(tap);
    return {
      bus: { source, gain, dest, tap, channels, track, stream: dest.stream },
      reason: null,
    };
  } catch {
    disconnectAll(made);
    return { bus: null, reason: "build-failed" };
  }
};

// One read of what the bus carried over the last ~40 ms. No waiting: by the
// time the mic recorder is built the graph has run through the screen start.
export const readTapRms = (tap) => {
  if (!tap) return null;
  try {
    const buf = new Float32Array(tap.fftSize);
    tap.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  } catch {
    return null;
  }
};

// Whether this take's mic recorder reads the bus. Anything short of a running
// context fed by the live mic track and carrying signal keeps the raw recorder.
export const micBusVerdict = ({ bus, liveTrack, ctxState, rms }) => {
  if (!bus) return { use: false, reason: "no-bus" };
  if (!liveTrack || bus.track !== liveTrack) {
    return { use: false, reason: "stale-track" };
  }
  if (liveTrack.readyState !== "live")
    return { use: false, reason: "track-ended" };
  if (ctxState !== "running") return { use: false, reason: `ctx-${ctxState}` };
  if (typeof rms !== "number" || !(rms >= BUS_SILENCE_RMS)) {
    return { use: false, reason: "no-signal" };
  }
  return { use: true, reason: null };
};

// Plugs a returned (or rebuilt) mic into the same gain. The fresh source is
// connected before the old one is dropped; a failure leaves the bus as it was.
export const wireMicBusTrack = ({ ctx, bus, track }) => {
  if (!ctx || !bus?.gain || !track) return false;
  let fresh = null;
  try {
    fresh = ctx.createMediaStreamSource(new MediaStream([track]));
    fresh.connect(bus.gain);
  } catch {
    try {
      fresh?.disconnect();
    } catch {}
    return false;
  }
  try {
    bus.source?.disconnect();
  } catch {}
  bus.source = fresh;
  bus.track = track;
  return true;
};

export const teardownMicFileBus = (bus) => {
  if (!bus) return;
  disconnectAll([bus.source, bus.gain, bus.tap, bus.dest]);
};
