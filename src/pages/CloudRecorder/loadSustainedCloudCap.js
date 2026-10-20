// Cloud encode cap bounded by what the device sustains (sustainedEncode.js).
// Separate from cloudEncodeCap.js so that file stays importable by the unit tests.
import {
  CAP_1080P,
  CAP_1440P,
  CAP_2160P,
  loadCloudEncodeCap,
  smallerCap,
} from "./cloudEncodeCap";
import { resolveSustainedTier, measureEncodeRate } from "./sustainedEncode";
import { avcCodecForSize } from "../../media/avcLevel";
import { prewarmSustainedEncode, prewarmSpeedTest } from "../Recorder/prewarmSustained";
import { smootherMotionActive } from "./screenFps";

const CAP_BY_TIER = { "2160p": CAP_2160P, "1440p": CAP_1440P, "1080p": CAP_1080P };

// What CloudRecorder asks getDisplayMedia for by default. The 60 fps rungs run
// only with smoother motion on, and need a capture track delivering >= 50 fps.
export const CLOUD_CAPTURE_FPS = 30;

// One run per frame rate and tier ceiling, shared by the prewarm and the click.
const sustained = new Map();

const readSmootherMotion = async () => {
  try {
    return smootherMotionActive(
      await chrome.storage.local.get(["smootherMotion", "fpsValue"])
    );
  } catch {
    return false;
  }
};

export const loadCloudEncodeCapSustained = async ({
  smootherMotion = false,
  trackFps = CLOUD_CAPTURE_FPS,
} = {}) => {
  const base = await loadCloudEncodeCap();
  const preferFps = smootherMotion === true && Number(trackFps) >= 50 ? 60 : 30;
  // At 30 fps 1080p is the floor and needs no test. 60 fps is tested at every
  // tier the account may use, 1080p included.
  if (base.tier === "1080p" && preferFps === 30) return { ...base, fps: 30 };
  try {
    const runKey = `${preferFps}:${base.tier}`;
    if (!sustained.has(runKey)) {
      sustained.set(
        runKey,
        resolveSustainedTier({
          preferFps,
          maxTier: base.tier,
          measure: (tier, opts) =>
            measureEncodeRate(tier, { ...opts, codecFor: avcCodecForSize }),
        })
      );
    }
    const { tier, fps } = await sustained.get(runKey);
    const cap = { ...CAP_BY_TIER[tier], tier };
    return { ...smallerCap(base, cap), fps };
  } catch {
    return { ...base, fps: 30 };
  }
};

// getDisplayMedia needs a recent user gesture and a cold speed test runs up to
// 6 s, so wait briefly: a cold cache records this take at 1080p, the test
// finishes for the next.
const COLD_CAP_WAIT_MS = 250;

export const loadCloudEncodeCapForClick = async (opts) => {
  const measured = loadCloudEncodeCapSustained(opts);
  const cold = new Promise((resolve) =>
    setTimeout(
      () => resolve({ ...CAP_1080P, tier: "1080p", fps: 30 }),
      COLD_CAP_WAIT_MS
    )
  );
  return Promise.race([measured, cold]);
};

// With cloud4kRecording off and smoother motion off the cloud part is a no-op
// (the loader returns before measuring).
export const prewarmCloudEncodeCap = () =>
  prewarmSpeedTest(async () => {
    try {
      const smootherMotion = await readSmootherMotion();
      await loadCloudEncodeCapSustained({
        smootherMotion,
        // Smoother motion asks for 60 at the click, so warm the 60 fps tiers.
        trackFps: smootherMotion ? 60 : CLOUD_CAPTURE_FPS,
      });
    } catch {}
    // After the cloud run, not beside it: two flat-out encodes skew each
    // other's rates. Local Auto reads the same cache.
    await prewarmSustainedEncode();
  });
