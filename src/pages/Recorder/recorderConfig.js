import {
  readCache,
  passes,
  rateKey,
  TARGET_FPS,
} from "../CloudRecorder/sustainedEncode.js";

// Pair video + audio codec explicitly (w3c/mediacapture-record#194); Chrome
// mis-tags blob.type otherwise. MP4 (H.264+AAC) first since VFR VP9/WebM breaks
// downstream (Bunny drops frames, node-av SIGSEGVs); isTypeSupported gates it.
export const MIME_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=h264,opus",
  "video/webm;codecs=avc1,opus",
  "video/webm",
  "video/mp4",
];

export function getBitrates(quality) {
  switch (quality) {
    case "4k":
      return { audio: 192000, video: 20000000 };
    case "1080p":
      return { audio: 128000, video: 12000000 };
    case "720p":
      return { audio: 128000, video: 5000000 };
    case "480p":
      return { audio: 96000, video: 3000000 };
    case "360p":
      return { audio: 96000, video: 1500000 };
    case "240p":
      return { audio: 64000, video: 1000000 };
    default:
      return { audio: 128000, video: 12000000 };
  }
}
export const VIDEO_QUALITIES = {
  "4k": { width: 4096, height: 2160 },
  "1080p": { width: 1920, height: 1080 },
  "720p": { width: 1280, height: 720 },
  "480p": { width: 854, height: 480 },
  "360p": { width: 640, height: 360 },
  "240p": { width: 426, height: 240 },
  default: { width: 1920, height: 1080 },
};

export function getResolutionForQuality(qualityValue = "default") {
  return VIDEO_QUALITIES[qualityValue] || VIDEO_QUALITIES.default;
}

// bits/pixel/sec. 0.10 put 1080p30 at 6.2 Mbps, under the 0.15-0.25 screen
// content wants, and text edges are the first thing H.264 discards.
export const VIDEO_BPP_FPS_PRO = 0.15;
export const VIDEO_BPP_FPS_FREE = 0.08;
export const VIDEO_BPS_MIN = 4_000_000;
export const VIDEO_BPS_MAX = 24_000_000;

export function computeTargetVideoBps(width, height, fps, isPro = false) {
  const pixels = Number(width) * Number(height);
  const rate = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const factor = isPro ? VIDEO_BPP_FPS_PRO : VIDEO_BPP_FPS_FREE;
  const target = Math.round(pixels * rate * factor);
  return Math.max(VIDEO_BPS_MIN, Math.min(VIDEO_BPS_MAX, target));
}

const QUALITY_ORDER = ["240p", "360p", "480p", "720p", "1080p", "4k"];

export const AUTO = "auto";

// Rates the sustained-encode test cached for this device (null before it
// runs). Shared with the cloud recorder through localStorage.
const readSustainedRates = () => {
  try {
    return readCache(localStorage);
  } catch {
    return null;
  }
};

// Same RAM read the settings menu uses: Macs don't report deviceMemory.
export const deviceRamGb = () => {
  try {
    if (navigator.userAgent.includes("Macintosh")) return 32;
    return Number(navigator.deviceMemory) || 4;
  } catch {
    return 4;
  }
};

export async function getFreeCaptureCaps() {
  try {
    const {
      isLoggedIn,
      isSubscribed,
      fastRecorderProbe,
      smootherMotion,
      fpsValue,
    } = await chrome.storage.local.get([
      "isLoggedIn",
      "isSubscribed",
      "fastRecorderProbe",
      "smootherMotion",
      "fpsValue",
    ]);
    const isPro = Boolean(isLoggedIn && isSubscribed);
    return {
      isPro,
      maxQuality: "4k",
      maxFps: 60,
      support: fastRecorderProbe?.details || null,
      // The checkbox is disabled under a fixed fps, so a stored true is stale.
      smoother:
        smootherMotion === true &&
        !(Number.parseInt(fpsValue, 10) > 0),
      fixedFps:
        Number.parseInt(fpsValue, 10) > 0 ? Number.parseInt(fpsValue, 10) : null,
      sustained: readSustainedRates(),
      ram: deviceRamGb(),
    };
  } catch {
    return {
      isPro: false,
      maxQuality: "1080p",
      maxFps: 60,
      support: null,
      smoother: false,
      fixedFps: null,
      sustained: null,
      ram: 4,
    };
  }
}

const clampQuality = (value, maxValue) => {
  const current = QUALITY_ORDER.includes(value) ? value : "1080p";
  const max = QUALITY_ORDER.includes(maxValue) ? maxValue : "1080p";
  return QUALITY_ORDER.indexOf(current) <= QUALITY_ORDER.indexOf(max)
    ? current
    : max;
};

const hardware4kPassed = (support) =>
  support?.supports4k === true &&
  support?.supports4kConfig?.hardwareAcceleration === "prefer-hardware";

const MIN_AUTO_4K_RAM_GB = 8;

// True only if the speed test measured 4K keeping up at the Auto frame rate.
// Unmeasured is no: a new device's first take stays at 1080p while the cache fills.
const sustains4k = (sustained, fps) =>
  passes(sustained?.[rateKey("2160p", fps)], fps);

// Auto takes 4K only if the probe passed it on hardware AND the sustained test
// kept up, with a RAM floor as backstop. A picked 4k drops to 1080p only when
// the probe said 4K can't be encoded; an unknown probe keeps the choice.
export function resolveQualityValue(stored, caps = {}) {
  const {
    maxQuality = "4k",
    support = null,
    smoother = false,
    fixedFps = null,
    sustained = null,
    ram = MIN_AUTO_4K_RAM_GB,
  } = caps;
  if (stored === AUTO || stored === undefined || stored === null) {
    // A fixed 60 records at 60, so Auto must check the 60 result, not the 30 one.
    const fps = fixedFps > TARGET_FPS ? fixedFps : smoother ? 60 : TARGET_FPS;
    const wanted =
      hardware4kPassed(support) &&
      sustains4k(sustained, fps) &&
      ram >= MIN_AUTO_4K_RAM_GB
        ? "4k"
        : "1080p";
    return clampQuality(wanted, maxQuality);
  }
  const picked = QUALITY_ORDER.includes(stored) ? stored : "1080p";
  if (picked === "4k" && support?.supports4k === false) return "1080p";
  return clampQuality(picked, maxQuality);
}

export function resolveFps(stored, caps = {}) {
  const { smoother = false } = caps;
  const parsed = Number.parseInt(stored, 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return smoother ? 60 : 30;
}

// Every encode cap we ship is landscape, so a portrait source binds on HEIGHT
// and collapses the width (412x924 encoded to 482x1080). Orient the box to the
// source first so a cap means pixels on the long edge, not a shape.
export function orientBoxToSource(sourceWidth, sourceHeight, boxWidth, boxHeight) {
  const sw = Number(sourceWidth);
  const sh = Number(sourceHeight);
  const bw = Number(boxWidth);
  const bh = Number(boxHeight);
  if (![sw, sh, bw, bh].every((n) => Number.isFinite(n) && n > 0)) {
    return { width: boxWidth, height: boxHeight };
  }
  return sh > sw === bh > bw
    ? { width: bw, height: bh }
    : { width: bh, height: bw };
}
