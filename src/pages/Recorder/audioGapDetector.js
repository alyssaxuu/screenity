// Separated-mic gap detector. A customer's mic file had ~400 ms of exact digital
// silence mid-speech with nothing dropped by our encoder, so the loss was
// upstream. This watches the raw mic for runs of exact-zero samples (digital
// silence, as in that file) and for callbacks arriving late. It only reads a
// second tap of the track; the recorder keeps reading the original stream.

const BLOCK_FRAMES = 4096;

export const createGapDetector = ({
  sampleRate,
  minRunMs = 100,
  lateMs = 150,
  // The source emits zeros while it spins up; those are not a gap in speech.
  warmupMs = 500,
  maxEvents = 20,
  onGap = null,
} = {}) => {
  const toMs = (frames) => Math.round((frames / sampleRate) * 1000);
  const minRunFrames = Math.round((sampleRate * minRunMs) / 1000);
  const warmupFrames = Math.round((sampleRate * warmupMs) / 1000);

  // Audio time seen so far, so offsets line up with the file and not the wall.
  let frames = 0;
  let runStart = 0;
  let runLen = 0;
  let lastWallMs = null;
  const gaps = [];
  const lates = [];
  const totals = { gapCount: 0, gapMaxMs: 0, lateCount: 0, lateMaxMs: 0 };

  const closeRun = () => {
    if (runLen >= minRunFrames && runStart >= warmupFrames) {
      const gap = { atMs: toMs(runStart), ms: toMs(runLen) };
      totals.gapCount += 1;
      totals.gapMaxMs = Math.max(totals.gapMaxMs, gap.ms);
      if (gaps.length < maxEvents) {
        gaps.push(gap);
        try {
          onGap?.(gap);
        } catch {}
      }
    }
    runLen = 0;
  };

  const snapshot = () => ({
    monitoredMs: toMs(frames),
    ...totals,
    gaps: gaps.slice(),
    lates: lates.slice(),
  });

  return {
    // active=false (muted, track ended, context not running): the zeros are
    // expected, so drop any run and keep the clock moving. paused=true: the file
    // is not advancing either, so freeze it.
    push(samples, { wallMs, active = true, paused = false } = {}) {
      if (paused) {
        runLen = 0;
        lastWallMs = null;
        return;
      }
      if (active && lastWallMs !== null) {
        const late = wallMs - lastWallMs - (samples.length / sampleRate) * 1000;
        if (late > lateMs) {
          const entry = { atMs: toMs(frames), lateMs: Math.round(late) };
          totals.lateCount += 1;
          totals.lateMaxMs = Math.max(totals.lateMaxMs, entry.lateMs);
          if (lates.length < maxEvents) lates.push(entry);
        }
      }
      lastWallMs = active ? wallMs : null;
      if (!active) {
        runLen = 0;
        frames += samples.length;
        return;
      }
      for (let i = 0; i < samples.length; i += 1) {
        if (samples[i] === 0) {
          if (runLen === 0) runStart = frames + i;
          runLen += 1;
        } else if (runLen > 0) {
          closeRun();
        }
      }
      frames += samples.length;
    },
    // A run still open at the end of the take is a gap too.
    finish() {
      closeRun();
      return snapshot();
    },
    snapshot,
  };
};

// Main-thread side of audioGapWorklet.js: same totals and event lists as
// createGapDetector, fed by the worklet's run events and heartbeats instead of
// raw samples. A heartbeat stands in for a ScriptProcessor callback, so "late"
// still means audio-paced work reaching the main thread late.
export const createWorkletGapSink = ({
  sampleRate,
  minRunMs = 100,
  lateMs = 150,
  warmupMs = 500,
  maxEvents = 20,
  onGap = null,
} = {}) => {
  const toMs = (frames) => Math.round((frames / sampleRate) * 1000);
  const minRunFrames = Math.round((sampleRate * minRunMs) / 1000);
  const warmupFrames = Math.round((sampleRate * warmupMs) / 1000);

  let frames = 0;
  let openRun = null;
  let lastWallMs = null;
  const gaps = [];
  const lates = [];
  const totals = { gapCount: 0, gapMaxMs: 0, lateCount: 0, lateMaxMs: 0 };

  const countRun = (start, len) => {
    if (len < minRunFrames || start < warmupFrames) return;
    const gap = { atMs: toMs(start), ms: toMs(len) };
    totals.gapCount += 1;
    totals.gapMaxMs = Math.max(totals.gapMaxMs, gap.ms);
    if (gaps.length < maxEvents) {
      gaps.push(gap);
      try {
        onGap?.(gap);
      } catch {}
    }
  };

  const snapshot = () => ({
    monitoredMs: toMs(frames),
    ...totals,
    gaps: gaps.slice(),
    lates: lates.slice(),
  });

  return {
    minRunFrames,
    gap({ start, len }) {
      if (openRun?.start === start) openRun = null;
      countRun(start, len);
    },
    heartbeat(hb, { wallMs, active = true, paused = false } = {}) {
      frames = hb.frames;
      openRun = hb.runLen > 0 ? { start: hb.runStart, len: hb.runLen } : null;
      if (paused) {
        lastWallMs = null;
        return;
      }
      if (active && lastWallMs !== null) {
        const late = wallMs - lastWallMs - (hb.rendered / sampleRate) * 1000;
        if (late > lateMs) {
          const entry = { atMs: toMs(hb.at), lateMs: Math.round(late) };
          totals.lateCount += 1;
          totals.lateMaxMs = Math.max(totals.lateMaxMs, entry.lateMs);
          if (lates.length < maxEvents) lates.push(entry);
        }
      }
      lastWallMs = active ? wallMs : null;
    },
    finish() {
      if (openRun) countRun(openRun.start, openRun.len);
      openRun = null;
      return snapshot();
    },
    snapshot,
  };
};

export const GAP_WORKLET_FILE = "audioGapWorklet.js";
const GAP_PROCESSOR = "screenity-gap-scan";
const workletLoads = new WeakMap();

const loadGapWorklet = (ctx) => {
  if (!workletLoads.has(ctx)) {
    const url = globalThis.chrome?.runtime?.getURL?.(GAP_WORKLET_FILE);
    const load =
      url && ctx.audioWorklet && typeof AudioWorkletNode !== "undefined"
        ? ctx.audioWorklet.addModule(url)
        : Promise.reject(new Error("no audio worklet"));
    workletLoads.set(ctx, load);
  }
  return workletLoads.get(ctx);
};

// The scan runs in an AudioWorklet so the main thread only handles a message
// every ~85 ms. If the module fails to load, falls back to a 4096-frame
// ScriptProcessor running createGapDetector. Never throws into the caller.
export const attachGapDetector = (ctx, track, { isPaused, onGap } = {}) => {
  const isActive = () =>
    track.enabled && track.readyState === "live" && ctx.state === "running";
  let detector = createWorkletGapSink({ sampleRate: ctx.sampleRate, onGap });
  let disposed = false;
  let teardown = null;

  const connect = (node) => {
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    // Private sink so the node is pulled without touching the recording bus.
    const sink = ctx.createMediaStreamDestination();
    source.connect(node);
    node.connect(sink);
    return () => {
      try {
        source.disconnect();
        node.disconnect();
      } catch {}
    };
  };

  const startScriptProcessor = () => {
    if (disposed) return;
    try {
      const fallback = createGapDetector({ sampleRate: ctx.sampleRate, onGap });
      const node = ctx.createScriptProcessor(BLOCK_FRAMES, 1, 1);
      node.onaudioprocess = (event) => {
        try {
          fallback.push(event.inputBuffer.getChannelData(0), {
            wallMs: performance.now(),
            active: isActive(),
            paused: Boolean(isPaused?.()),
          });
        } catch {}
      };
      const disconnect = connect(node);
      detector = fallback;
      teardown = () => {
        node.onaudioprocess = null;
        disconnect();
      };
    } catch {}
  };

  const startWorklet = () => {
    if (disposed) return;
    const sink = detector;
    const node = new AudioWorkletNode(ctx, GAP_PROCESSOR, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: "explicit",
      processorOptions: {
        minRunFrames: sink.minRunFrames,
        heartbeatFrames: BLOCK_FRAMES,
      },
    });
    // active and paused are main-thread facts. They are re-read on each
    // heartbeat and pushed to the worklet when they change.
    let sent = { active: isActive(), paused: Boolean(isPaused?.()) };
    node.port.postMessage(sent);
    node.port.onmessage = (event) => {
      try {
        const msg = event.data;
        if (msg?.t === "gap") {
          sink.gap(msg);
          return;
        }
        if (msg?.t !== "hb") return;
        const state = { active: isActive(), paused: Boolean(isPaused?.()) };
        sink.heartbeat(msg, { wallMs: performance.now(), ...state });
        if (state.active !== sent.active || state.paused !== sent.paused) {
          sent = state;
          node.port.postMessage(state);
        }
      } catch {}
    };
    let disconnect;
    try {
      disconnect = connect(node);
    } catch (err) {
      node.port.onmessage = null;
      try {
        node.disconnect();
      } catch {}
      throw err;
    }
    teardown = () => {
      node.port.onmessage = null;
      try {
        node.port.close();
      } catch {}
      disconnect();
    };
  };

  try {
    loadGapWorklet(ctx)
      .then(startWorklet)
      .catch(startScriptProcessor);
  } catch {
    startScriptProcessor();
  }

  return {
    snapshot: () => detector.snapshot(),
    finish: () => detector.finish(),
    dispose() {
      disposed = true;
      teardown?.();
      teardown = null;
    },
  };
};

// Flat numeric keys for the server telemetry sanitizer, which whitelists
// audioDiag one key at a time. The offsets travel in the diag event instead.
export const flattenGapDiag = (snap) =>
  snap
    ? {
        micGapCount: snap.gapCount,
        micGapMaxMs: snap.gapMaxMs,
        micLateCount: snap.lateCount,
        micLateMaxMs: snap.lateMaxMs,
      }
    : {};
