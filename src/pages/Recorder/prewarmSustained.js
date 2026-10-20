import {
  resolveSustainedTier,
  measureEncodeRate,
  TARGET_FPS,
} from "../CloudRecorder/sustainedEncode";
import { avcCodecForSize } from "../../media/avcLevel";
import { smootherMotionActive } from "../CloudRecorder/screenFps";

// Auto only takes 4K once the sustained test has passed on this device, so fill
// the cache before the first take. Only runs when Auto could pick 4K.
export const prewarmSustainedEncode = async () => {
  try {
    const stored = await chrome.storage.local.get([
      "qualityValue",
      "fastRecorderProbe",
      "smootherMotion",
      "fpsValue",
    ]);
    const { qualityValue, fastRecorderProbe } = stored;
    const auto = qualityValue === undefined || qualityValue === "auto";
    if (!auto || fastRecorderProbe?.details?.supports4k !== true) return;
    await resolveSustainedTier({
      preferFps:
        Number.parseInt(stored.fpsValue, 10) > TARGET_FPS
          ? Number.parseInt(stored.fpsValue, 10)
          : smootherMotionActive(stored)
            ? 60
            : TARGET_FPS,
      measure: (tier, opts) =>
        measureEncodeRate(tier, { ...opts, codecFor: avcCodecForSize }),
    });
  } catch {}
};

const pageVisible = () =>
  typeof document === "undefined" ||
  (!document.hidden && document.visibilityState === "visible");

const recordingInProgress = async () => {
  try {
    const { recording } = await chrome.storage.local.get("recording");
    return recording === true;
  } catch {
    return false;
  }
};

// Runs a speed test when it cannot disturb anything: the tab is shown (a
// background tab throttles timers and the skewed rate is cached for 14 days),
// no recording is running (a flat-out encode would drop its frames and measure
// low), and no other tab is already testing. Skipped runs retry on the next
// page load; the click still measures if the cache is cold.
export const prewarmSpeedTest = (task) => {
  if (typeof window === "undefined") return;
  const run = async () => {
    if (!pageVisible()) {
      document.addEventListener("visibilitychange", () => schedule(), { once: true });
      return;
    }
    if (await recordingInProgress()) return;
    const exclusive = (fn) =>
      navigator.locks
        ? navigator.locks.request("screenity-speed-test", { ifAvailable: true }, (lock) =>
            lock ? fn() : undefined
          )
        : fn();
    try {
      await exclusive(task);
    } catch {}
  };
  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 200);
    }
  };
  schedule();
};
