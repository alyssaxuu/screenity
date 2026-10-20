// Cloud screen encode cap. 1080p by default; above that needs the cloud4kRecording
// flag and a hardware encoder that passed the gate's large-frame probe (software
// 4K on a weak CPU drops frames, and smooth 1080p beats stuttering 4K).
// The cap is a box, never an upscale: a 14" MacBook lands near 1964 tall.
// Tests: tests/unit/cloudEncodeCap.test.mjs

export const CLOUD_4K_FLAG_KEY = "cloud4kRecording";

export const CAP_1080P = { width: 1920, height: 1080 };
export const CAP_1440P = { width: 2560, height: 1440 };
export const CAP_2160P = { width: 3840, height: 2160 };

// Matches the probe in fastRecorderGate.ts (LARGE_FRAME_PROBES).
export const CLOUD_BITRATE_1080P = 16_000_000;
export const CLOUD_BITRATE_1440P = 20_000_000;
export const CLOUD_BITRATE_2160P = 24_000_000;

// Only an explicit prefer-hardware config counts; a software pass does not.
const hardwarePassed = (support, key) => {
  const config = support?.[`${key}Config`];
  return support?.[key] === true && config?.hardwareAcceleration === "prefer-hardware";
};

export const resolveCloudEncodeCap = ({ enabled, support } = {}) => {
  if (!enabled) return { ...CAP_1080P, tier: "1080p" };
  if (hardwarePassed(support, "supports4k")) return { ...CAP_2160P, tier: "2160p" };
  if (hardwarePassed(support, "supports1440p")) return { ...CAP_1440P, tier: "1440p" };
  return { ...CAP_1080P, tier: "1080p" };
};

// Smaller cap by area: the probe says what the encoder accepts, the sustained
// test what it keeps up with.
export const smallerCap = (a, b) =>
  Number(a?.width) * Number(a?.height) <= Number(b?.width) * Number(b?.height) ? a : b;

// Twice the frames need roughly 1.5x the bits. Must equal bitrateAtFps in
// sustainedEncode.js (a test enforces it) so the speed test and encoder agree.
export const FPS_BITRATE_FACTOR = 1.5;

export const cloudBitrateForCap = (cap, fps = 30) => {
  const area = Number(cap?.width) * Number(cap?.height);
  let bitrate = CLOUD_BITRATE_1080P;
  if (area > CAP_1440P.width * CAP_1440P.height) bitrate = CLOUD_BITRATE_2160P;
  else if (area > CAP_1080P.width * CAP_1080P.height) bitrate = CLOUD_BITRATE_1440P;
  return fps > 30 ? Math.round(bitrate * FPS_BITRATE_FACTOR) : bitrate;
};

// PATCH size above 1080p; the uploader's 512 KB default stays at 1080p and below.
// Each PATCH is a serial round trip, so a high-latency link falls behind a 24 Mbps
// stream. 2 MB keeps a 20 s PATCH timeout reachable down to about 0.8 Mbps.
// 60 fps takes the same chunk at any size: 1080p60 is 24 Mbps, the 4K figure.
export const UPLOAD_CHUNK_SIZE_4K = 2 * 1024 * 1024;

export const uploadChunkSizeForCap = (cap, fps = 30) =>
  Number(cap?.width) * Number(cap?.height) >
    CAP_1080P.width * CAP_1080P.height || fps > 30
    ? UPLOAD_CHUNK_SIZE_4K
    : undefined;

export const loadCloudEncodeCap = async () => {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return resolveCloudEncodeCap({ enabled: false });
    }
    const stored = await chrome.storage.local.get([
      CLOUD_4K_FLAG_KEY,
      "fastRecorderProbe",
    ]);
    return resolveCloudEncodeCap({
      enabled: stored[CLOUD_4K_FLAG_KEY] === true,
      support: stored.fastRecorderProbe?.details,
    });
  } catch {
    return resolveCloudEncodeCap({ enabled: false });
  }
};
