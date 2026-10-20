// Per-source level probe. The silence watchdog only hears the mixed bus, so a
// silent report can't say whether the mic, the system audio, or our own graph
// went quiet. This taps a raw track before any gain and keeps running stats.

const ACTIVE_DEVIATION = 2;

export const byteDeviationToDb = (dev) =>
  dev > 0 ? Math.round(20 * Math.log10(dev / 128) * 10) / 10 : null;

export const createSourceStats = (now = Date.now) => {
  const startedAt = now();
  let samples = 0;
  let activeSamples = 0;
  let peak = 0;
  let windowPeak = 0;
  let firstActiveMs = null;
  let lastActiveMs = null;

  return {
    record(maxDev) {
      samples += 1;
      if (maxDev > peak) peak = maxDev;
      if (maxDev > windowPeak) windowPeak = maxDev;
      if (maxDev >= ACTIVE_DEVIATION) {
        activeSamples += 1;
        const at = now() - startedAt;
        if (firstActiveMs === null) firstActiveMs = at;
        lastActiveMs = at;
      }
    },
    snapshot({ resetWindow = false } = {}) {
      const out = {
        samples,
        activeSamples,
        everActive: firstActiveMs !== null,
        firstActiveMs,
        lastActiveMs,
        peakDb: byteDeviationToDb(peak),
        windowPeakDb: byteDeviationToDb(windowPeak),
      };
      if (resetWindow) windowPeak = 0;
      return out;
    },
  };
};

export const createSourceProbe = (ctx, track) => {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const source = ctx.createMediaStreamSource(new MediaStream([track]));
  source.connect(analyser);
  const buf = new Uint8Array(analyser.frequencyBinCount);
  const stats = createSourceStats();

  return {
    sample() {
      analyser.getByteTimeDomainData(buf);
      let maxDev = 0;
      for (let i = 0; i < buf.length; i += 1) {
        const dev = Math.abs(buf[i] - 128);
        if (dev > maxDev) maxDev = dev;
      }
      stats.record(maxDev);
    },
    snapshot: (opts) => stats.snapshot(opts),
    dispose() {
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {}
    },
  };
};

export const snapshotProbes = (probes, opts) => {
  const out = {};
  for (const [name, probe] of Object.entries(probes || {})) {
    out[name] = probe.snapshot(opts);
  }
  return out;
};

// Flat, numeric/boolean keys for the server telemetry sanitizer, which
// whitelists audioDiag one key at a time and has no nested pass-through.
export const flattenProbeDiag = (snapshots) => {
  const out = {};
  for (const name of ["sys", "mic"]) {
    const s = snapshots?.[name];
    if (!s) continue;
    out[`${name}EverActive`] = s.everActive;
    out[`${name}FirstActiveMs`] = s.firstActiveMs;
    out[`${name}PeakDb`] = s.peakDb;
    out[`${name}WindowPeakDb`] = s.windowPeakDb;
    out[`${name}ActiveRatio`] = s.samples
      ? Math.round((s.activeSamples / s.samples) * 100) / 100
      : null;
  }
  return out;
};
