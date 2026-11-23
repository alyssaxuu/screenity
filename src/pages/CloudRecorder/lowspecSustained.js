// Sustained-encode results for the adaptive policy's start rung: 1080p30 and
// 720p30. 1080p20 is not measured: the test encodes flat out, so the 1080p30
// rate covers it. Kept apart from sustainedEncode.js so the existing ladder,
// cache and tests are untouched with the flag off.
// Measured at idle only (prewarmSpeedTest), never at click or during a take;
// the click reads the cache and treats a miss as unknown.
// Only a measured rate counts. A timeout, failure or "unsupported" is unknown
// and never lowers the start rung (a cold hardware encoder times out on strong
// machines too); it is not retried for FAIL_RETRY_MS.
// Tests: tests/unit/adaptivePolicyRuntime.test.mjs
import { passes, deviceKey, TIERS } from "./sustainedEncode.js";

export const LOWSPEC_CACHE_KEY = "screenity_lowspec_rates_v1";
export const LOWSPEC_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const FAIL_RETRY_MS = 6 * 60 * 60 * 1000;

const T1080 = TIERS.find((t) => t.tier === "1080p");
// 720p at 8 Mbps, the bitrate cap of rung R3.
export const LOWSPEC_TESTS = [
  { key: "1080p30", ...T1080, fps: 30 },
  {
    key: "720p30",
    tier: "720p",
    width: 1280,
    height: 720,
    bitrate: 8_000_000,
    fps: 30,
  },
];

const measured = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;

// rates { "1080p30": fps measured, ... } -> the controller's input shape.
export const ratesToResult = (rates) => {
  const r = rates && typeof rates === "object" ? rates : {};
  const verdict = (key, fps) => (measured(r[key]) ? passes(r[key], fps) : null);
  return {
    ok1080p30: verdict("1080p30", 30),
    ok1080p20: verdict("1080p30", 20),
    ok720p30: verdict("720p30", 30),
  };
};

export const readLowspecResult = (
  storage,
  now = Date.now(),
  key = deviceKey()
) => {
  try {
    const raw = storage?.getItem(LOWSPEC_CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v?.key !== key || !(now - v.at < LOWSPEC_TTL_MS)) return null;
    return ratesToResult(v.rates);
  } catch {
    return null;
  }
};

const readEntry = (storage, now, key) => {
  try {
    const v = JSON.parse(storage?.getItem(LOWSPEC_CACHE_KEY) || "null");
    if (v?.key !== key || !(now - v.at < LOWSPEC_TTL_MS)) return null;
    return v;
  } catch {
    return null;
  }
};

// measure(test) returns fps, or <= 0 for unsupported, timed out or failed.
// Skips what is cached or failed recently, and stops once canRun() (may be
// async) says a take is under way. Never throws.
export const measureLowspec = async ({
  measure,
  storage,
  canRun = () => true,
  now = Date.now(),
  key = deviceKey(),
}) => {
  const prev = readEntry(storage, now, key);
  const rates = { ...(prev?.rates || {}) };
  const fails = { ...(prev?.fails || {}) };
  let changed = false;
  try {
    for (const test of LOWSPEC_TESTS) {
      if (measured(rates[test.key])) continue;
      if (now - (fails[test.key] || 0) < FAIL_RETRY_MS) continue;
      if (!(await canRun())) break;
      const rate = await measure(test);
      changed = true;
      if (measured(rate)) {
        rates[test.key] = rate;
        delete fails[test.key];
      } else {
        fails[test.key] = now;
      }
    }
    if (changed) {
      storage?.setItem(
        LOWSPEC_CACHE_KEY,
        JSON.stringify({ key, at: prev?.at ?? now, rates, fails })
      );
    }
  } catch {}
  return ratesToResult(rates);
};

// Idle prewarm: a no-op unless the server flag is on and fresh. `canRun` is
// checked before each test.
export const prewarmLowspec = async ({ flags, measure, storage, canRun }) => {
  try {
    if (flags?.adaptivePolicy !== true) return null;
    return await measureLowspec({ measure, storage, canRun });
  } catch {
    return null;
  }
};
