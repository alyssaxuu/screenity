// MediaRecorder bakes the frame size into the header, so a surface resized
// across a 16px macroblock boundary corrupts the rest of the file.
// Fixed-size canvas relay, same letterbox transform as WebCodecs (immune).
// rAF doesn't fire in an offscreen document, so track processor reads drive frames.
import { computeLetterboxRect } from "./webcodecs/letterbox";

export const isDimensionLockDisabled = async () => {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return false;
    const { disableDimensionLock } = await chrome.storage.local.get([
      "disableDimensionLock",
    ]);
    return disableDimensionLock === true;
  } catch {
    return false;
  }
};

export const canLockDimensions = () =>
  typeof MediaStreamTrackProcessor !== "undefined" &&
  typeof MediaStreamTrackGenerator !== "undefined" &&
  typeof VideoFrame !== "undefined";

// Holds one video size for the whole recording, audio passes through. Returns
// null when locking isn't possible, so the caller records the source directly.
export function createDimensionLockedStream(
  sourceStream,
  { width, height, fps, onError }
) {
  if (!sourceStream || !canLockDimensions()) return null;
  const sourceTrack = sourceStream.getVideoTracks?.()[0];
  if (!sourceTrack) return null;

  const tw = Math.max(2, Math.round(width / 2) * 2);
  const th = Math.max(2, Math.round(height / 2) * 2);
  const frameRate = fps > 0 ? fps : 30;
  const frameDurationUs = Math.round(1_000_000 / frameRate);

  let canvas;
  let ctx;
  let generator;
  let writer;
  let reader;
  try {
    canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    generator = new MediaStreamTrackGenerator({ kind: "video" });
    writer = generator.writable.getWriter();
    reader = new MediaStreamTrackProcessor({
      track: sourceTrack,
    }).readable.getReader();
  } catch {
    return null;
  }

  const stats = {
    framesIn: 0,
    framesOut: 0,
    sourceSizeChanges: 0,
    lastSourceSize: null,
    error: null,
  };
  let stopped = false;
  // Source timestamps, rebased to zero. The frame counter they replace assumed
  // the source delivers fps frames a second, which static capture never does.
  let baseTs = null;
  let lastOutTs = null;

  const pump = (async () => {
    while (!stopped) {
      let frame;
      try {
        const { value, done } = await reader.read();
        if (done || !value) break;
        frame = value;
      } catch (err) {
        stats.error = String(err);
        break;
      }
      stats.framesIn += 1;
      const frameTs = Number.isFinite(frame.timestamp) ? frame.timestamp : null;
      const sw = frame.codedWidth;
      const sh = frame.codedHeight;
      if (
        !stats.lastSourceSize ||
        stats.lastSourceSize.width !== sw ||
        stats.lastSourceSize.height !== sh
      ) {
        if (stats.lastSourceSize) stats.sourceSizeChanges += 1;
        stats.lastSourceSize = { width: sw, height: sh };
      }

      const rect = computeLetterboxRect({ sw, sh, tw, th });
      try {
        // A fitted draw misses pixels. Without the clear the previous surface
        // stays frozen in the bars around the new one.
        if (!rect.fills) {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, tw, th);
        }
        ctx.drawImage(frame, rect.x, rect.y, rect.w, rect.h);
      } catch (err) {
        stats.error = String(err);
        frame.close();
        break;
      }
      frame.close();

      let out;
      try {
        // Carry the source clock rather than a frame counter. Measured: this
        // Chromium stamps generator frames on arrival, so it is defensive only.
        let tsUs;
        if (frameTs === null) {
          tsUs = lastOutTs === null ? 0 : lastOutTs + frameDurationUs;
        } else {
          if (baseTs === null) baseTs = frameTs;
          tsUs = frameTs - baseTs;
        }
        // A repeat or a step back across a surface switch is the one input
        // MediaRecorder has no defined answer for.
        if (lastOutTs !== null && tsUs <= lastOutTs) tsUs = lastOutTs + 1;
        lastOutTs = tsUs;
        out = new VideoFrame(canvas, { timestamp: tsUs });
      } catch (err) {
        stats.error = String(err);
        break;
      }
      try {
        await writer.write(out);
        stats.framesOut += 1;
      } catch (err) {
        // Writer closed under us (recording stopped, track ended).
        try {
          out.close();
        } catch {}
        stats.error = String(err);
        break;
      }
    }
    // A break leaves the generator live, so MediaRecorder keeps finalizing a
    // file that stopped receiving frames. Never fires for our own stop.
    if (!stopped && stats.error) {
      try {
        onError?.({ ...stats });
      } catch {}
    }
  })();

  const stream = new MediaStream([generator]);
  for (const track of sourceStream.getAudioTracks?.() || []) {
    stream.addTrack(track);
  }

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try {
      await reader.cancel();
    } catch {}
    try {
      await writer.close();
    } catch {}
    try {
      await pump;
    } catch {}
    try {
      generator.stop();
    } catch {}
  };

  return { stream, stop, stats, width: tw, height: th };
}
