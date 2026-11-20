// Mic silence check for the stop path. A 2 h take is VBR Opus, so a near-silent mic is under 2 MB:
// file size says nothing about samples, and decoding all of it would be 1+ GB. Only a known-short take
// is decoded whole; otherwise 12 to 16 windows are spread by bytes (so they land where the sound is),
// cut at cluster (webm) or fragment (mp4) boundaries to 3 to 10 s, under 160 s of audio. Silent only if
// every window is. A file we cannot sample, or a decode failure, answers "not silent": a wrong "silent"
// drops the voice, a wrong "not silent" only keeps a quiet file.

export const SILENCE_THRESHOLD = 0.01;
export const WHOLE_DECODE_MAX_SECONDS = 120;
export const SMALL_LIMIT_BYTES = 16 * 1024 * 1024;
export const MIN_WINDOWS = 12;
export const MAX_WINDOWS = 16;
export const WINDOW_SECONDS = 3;
export const MAX_WINDOW_SECONDS = 10;
// One more window per 7.5 minutes past 90, so a 2 h take gets 16.
const SECONDS_PER_WINDOW = 450;
// Opus tops out at 510 kbps, about 640 KB in MAX_WINDOW_SECONDS.
const MAX_WINDOW_BYTES = 1024 * 1024;
const HEADER_SCAN_BYTES = 4 * 1024 * 1024;
const MARKER_SCAN_BYTES = 1024 * 1024;

const detectContainer = (b) => {
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
    return "webm";
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70)
    return "mp4";
  return null;
};

const readUint = (b, i, len) => {
  let v = 0;
  for (let k = 0; k < len; k++) v = v * 256 + b[i + k];
  return v;
};

// EBML variable-length integer at i: { len, value }, or null.
const readVint = (b, i) => {
  const first = b[i];
  if (!first) return null;
  let len = 1;
  while (!(first & (0x80 >> (len - 1)))) len++;
  if (i + len > b.length) return null;
  let value = first & (0xff >> len);
  for (let k = 1; k < len; k++) value = value * 256 + b[i + k];
  return { len, value };
};

const isType = (b, i, a, c, d, e) =>
  b[i] === a && b[i + 1] === c && b[i + 2] === d && b[i + 3] === e;

// Offset of the next Cluster (webm) or moof box (mp4) at or after `from`, or -1.
const nextMarker = (container, b, from) => {
  if (container === "webm") {
    for (let i = from; i + 4 <= b.length; i++) {
      if (isType(b, i, 0x1f, 0x43, 0xb6, 0x75)) return i;
    }
  } else {
    for (let i = Math.max(4, from + 4); i + 4 <= b.length; i++) {
      if (isType(b, i, 0x6d, 0x6f, 0x6f, 0x66)) return i - 4;
    }
  }
  return -1;
};

// Seconds per timestamp unit, from the header: webm TimecodeScale (default
// 1 ms), mp4 mdhd timescale (no default, so no windows without it).
const timeUnit = (container, header) => {
  if (container === "webm") {
    for (let i = 0; i + 4 <= header.length; i++) {
      if (header[i] !== 0x2a || header[i + 1] !== 0xd7 || header[i + 2] !== 0xb1) continue;
      const l = readVint(header, i + 3);
      if (!l || l.value < 1 || l.value > 8 || i + 3 + l.len + l.value > header.length) break;
      const scale = readUint(header, i + 3 + l.len, l.value);
      if (scale > 0) return scale / 1e9;
      break;
    }
    return 1e-3;
  }
  for (let i = 4; i + 4 <= header.length; i++) {
    if (!isType(header, i, 0x6d, 0x64, 0x68, 0x64)) continue;
    const at = i + 8 + (header[i + 4] === 1 ? 16 : 8);
    if (at + 4 > header.length) return null;
    const timescale = readUint(header, at, 4);
    return timescale > 0 ? 1 / timescale : null;
  }
  return null;
};

// Timestamp of the marker at p: the Cluster's Timecode, or the moof's tfdt.
const markerTime = (container, b, p) => {
  if (container === "webm") {
    const size = readVint(b, p + 4);
    if (!size) return null;
    const q = p + 4 + size.len;
    if (b[q] !== 0xe7) return null;
    const l = readVint(b, q + 1);
    if (!l || l.value < 1 || l.value > 8 || q + 1 + l.len + l.value > b.length) return null;
    return readUint(b, q + 1 + l.len, l.value);
  }
  for (let i = p + 8; i < p + 256 && i + 16 <= b.length; i++) {
    if (isType(b, i, 0x74, 0x66, 0x64, 0x74)) {
      return b[i + 4] === 1 ? readUint(b, i + 8, 8) : readUint(b, i + 8, 4);
    }
  }
  return null;
};

// From the first timed marker in the scan range to the first one at least WINDOW_SECONDS later. Null
// when none closes within MAX_WINDOW_SECONDS (and MAX_WINDOW_BYTES): nothing inside a cluster can be cut by time.
const pickWindow = (container, b, unit) => {
  let start = -1;
  let t0 = 0;
  for (let p = nextMarker(container, b, 0); p >= 0; p = nextMarker(container, b, p + 1)) {
    const t = markerTime(container, b, p);
    if (t === null) continue;
    if (start < 0) {
      if (p > MARKER_SCAN_BYTES) return null;
      start = p;
      t0 = t;
      continue;
    }
    if (p - start > MAX_WINDOW_BYTES) return null;
    const span = (t - t0) * unit;
    if (span < WINDOW_SECONDS) continue;
    return span <= MAX_WINDOW_SECONDS ? { start, end: p } : null;
  }
  return null;
};

export const windowCount = (durationSeconds) =>
  durationSeconds > 0
    ? Math.min(MAX_WINDOWS, Math.max(MIN_WINDOWS, Math.ceil(durationSeconds / SECONDS_PER_WINDOW)))
    : MIN_WINDOWS;

export const decodeChannel = async (arrayBuffer) => {
  const ctx = new OfflineAudioContext(1, 44100 * 40, 44100);
  const buf = await ctx.decodeAudioData(arrayBuffer);
  return buf.getChannelData(0);
};

const sumAbs = (data) => {
  let total = 0;
  for (let i = 0; i < data.length; i++) total += Math.abs(data[i]);
  return total;
};

const bytesOf = async (blob, from, to) =>
  new Uint8Array(await blob.slice(from, Math.min(blob.size, to)).arrayBuffer());

const sampleBlobs = async (blob, durationSeconds) => {
  const container = detectContainer(await bytesOf(blob, 0, 16));
  if (!container) return null;
  const top = await bytesOf(blob, 0, HEADER_SCAN_BYTES);
  const firstMarker = nextMarker(container, top, 0);
  if (firstMarker <= 0) return null;
  const unit = timeUnit(container, top.subarray(0, firstMarker));
  if (!unit) return null;
  const header = blob.slice(0, firstMarker);
  const count = windowCount(durationSeconds);
  const windows = [];
  let floor = firstMarker;
  for (let k = 0; k < count; k++) {
    const from = Math.max(floor, Math.floor((blob.size * k) / count));
    if (from >= blob.size) break;
    const b = await bytesOf(blob, from, from + MARKER_SCAN_BYTES + MAX_WINDOW_BYTES);
    const w = pickWindow(container, b, unit);
    if (!w) continue;
    windows.push(new Blob([header, blob.slice(from + w.start, from + w.end)]));
    floor = from + w.end;
  }
  // Too few windows to stand for the take: do not call it silent on them.
  return windows.length >= Math.ceil(count / 2) ? windows : null;
};

export const isAudioSilent = async (
  audioBlob,
  silenceThreshold = SILENCE_THRESHOLD,
  { decode = decodeChannel, durationSeconds = null } = {}
) => {
  const whole =
    durationSeconds > 0 &&
    durationSeconds <= WHOLE_DECODE_MAX_SECONDS &&
    audioBlob.size <= SMALL_LIMIT_BYTES;
  const parts = whole ? [audioBlob] : await sampleBlobs(audioBlob, durationSeconds);
  if (!parts || !parts.length) return false;
  // Every window, not their average: speech in one stretch of a long take
  // averages away against the rest.
  let heard = 0;
  for (const part of parts) {
    const data = await decode(await part.arrayBuffer());
    if (!data.length) continue;
    if (sumAbs(data) / data.length >= silenceThreshold) return false;
    heard++;
  }
  return heard > 0;
};

// A mic blob that will not decode must not end the stop path. The verdict only gates the
// transcription offer, so a failure reports "not silent" and the mic file is kept.
export const safeIsAudioSilent = async (isAudioSilent, audioBlob, onError) => {
  try {
    return await isAudioSilent(audioBlob);
  } catch (err) {
    if (onError) onError(err);
    return false;
  }
};
