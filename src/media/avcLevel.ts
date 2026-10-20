// Picks the AVC level string for a frame size. The ladder declares High L4.2
// (avc1.64002A) and Baseline L4.0 (avc1.42E028), but Chrome rejects a configure()
// whose coded area exceeds the declared level's MaxFS, so anything above 1080p
// needs a higher level. No imports on purpose: the gate and the recorder both
// pull this in, and the unit tests transpile it alone.
// Tests: tests/unit/avcLevel.test.mjs

// L4.2 MaxFS 8704 macroblocks * 256. 1080p (1920x1088 coded) is 2,088,960.
export const AVC_L42_MAX_CODED_AREA = 2_228_224;

// L5.1 MaxFS 36864 macroblocks * 256 (4096x2304). Same as AVC_MAX_PIXELS.
export const AVC_L51_MAX_CODED_AREA = 9_437_184;

const LEVEL_5_1 = 0x33;

const AVC_CODEC_RE = /^avc1\.([0-9a-f]{4})([0-9a-f]{2})$/i;

// H.264 codes frames in 16x16 macroblocks, so 1080p is coded as 1088 rows.
export const avcCodedArea = (width: number, height: number): number => {
  if (!(width > 0) || !(height > 0)) return 0;
  return Math.ceil(width / 16) * 16 * (Math.ceil(height / 16) * 16);
};

export const exceedsAvcL42 = (width: number, height: number): boolean =>
  avcCodedArea(width, height) > AVC_L42_MAX_CODED_AREA;

// L4.2 and L5.1 MaxMBPS (macroblocks per second). The level also bounds frame
// rate, so 4K60 needs 5.2 even though its frame size already fits 5.1.
const AVC_L42_MAX_MBPS = 522_240;
const AVC_L51_MAX_MBPS = 983_040;

const LEVEL_5_2 = 0x34;

const avcMacroblocksPerSecond = (
  width: number,
  height: number,
  fps: number
): number => {
  if (!(width > 0) || !(height > 0) || !(fps > 0)) return 0;
  return Math.ceil(width / 16) * Math.ceil(height / 16) * fps;
};

// Raises only the level byte when the frame is too big or too fast for the
// declared one. Fitting frames and non-avc1 codecs come back untouched. fps
// defaults to 30, which keeps every existing caller's result.
export const avcCodecForSize = (
  codec: string,
  width: number,
  height: number,
  fps: number = 30
): string => {
  const match = AVC_CODEC_RE.exec(codec || "");
  if (!match) return codec;
  let required = exceedsAvcL42(width, height) ? LEVEL_5_1 : 0;
  const mbps = fps > 30 ? avcMacroblocksPerSecond(width, height, fps) : 0;
  if (mbps > AVC_L51_MAX_MBPS) required = LEVEL_5_2;
  else if (mbps > AVC_L42_MAX_MBPS) required = Math.max(required, LEVEL_5_1);
  if (!required) return codec;
  const level = parseInt(match[2], 16);
  if (level >= required) return codec;
  return `avc1.${match[1]}${required.toString(16).toUpperCase()}`;
};

export type LargeFrameSupport = {
  supports1440p?: boolean;
  supports4k?: boolean;
};

const AREA_1440P = 2560 * 1440;

// True only when the gate probe positively said this size cannot be encoded.
// Unknown (probe cached before the large-frame checks existed) is not a reason
// to leave WebCodecs.
export const largeFrameKnownUnsupported = (
  width: number,
  height: number,
  support: LargeFrameSupport | null | undefined
): boolean => {
  if (!support || !exceedsAvcL42(width, height)) return false;
  if (width * height <= AREA_1440P) return support.supports1440p === false;
  return support.supports4k === false;
};
