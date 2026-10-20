/* global registerProcessor, AudioWorkletProcessor */
// Audio-thread half of the separated-mic gap detector. Copied as-is into the
// build (not bundled) so it loads with ctx.audioWorklet.addModule. It only
// tracks zero runs; totals, warmup and late checks stay on the main thread.
// Posts { t: "gap" } when a run of at least minRunFrames closes, and
// { t: "hb" } every heartbeatFrames rendered frames with the file clock and
// any open run, so finish() can close it without a round trip.

class GapScanProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options?.processorOptions || {};
    this.minRunFrames = opts.minRunFrames || 1;
    this.heartbeatFrames = opts.heartbeatFrames || 4096;
    // File clock: advances unless paused, like createGapDetector's frames.
    this.frames = 0;
    this.runStart = 0;
    this.runLen = 0;
    this.active = true;
    this.paused = false;
    this.rendered = 0;
    this.hbFrom = 0;
    this.port.onmessage = (event) => {
      const { active, paused } = event.data || {};
      this.active = active !== false;
      this.paused = paused === true;
      if (!this.active || this.paused) this.runLen = 0;
    };
  }

  closeRun() {
    if (this.runLen >= this.minRunFrames) {
      this.port.postMessage({ t: "gap", start: this.runStart, len: this.runLen });
    }
    this.runLen = 0;
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    const n = ch ? ch.length : 128;
    if (!this.paused) {
      if (this.active) {
        // No channel means the source went away; treat it as zeros, as the
        // ScriptProcessor's empty input buffer would read.
        for (let i = 0; i < n; i += 1) {
          if (!ch || ch[i] === 0) {
            if (this.runLen === 0) this.runStart = this.frames + i;
            this.runLen += 1;
          } else if (this.runLen > 0) {
            this.closeRun();
          }
        }
      }
      this.frames += n;
    }
    this.rendered += n;
    if (this.rendered >= this.heartbeatFrames) {
      this.port.postMessage({
        t: "hb",
        at: this.hbFrom,
        frames: this.frames,
        rendered: this.rendered,
        runStart: this.runStart,
        runLen: this.runLen,
      });
      this.rendered = 0;
      this.hbFrom = this.frames;
    }
    return true;
  }
}

try {
  registerProcessor("screenity-gap-scan", GapScanProcessor);
} catch {}
