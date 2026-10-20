/*
 * Which encode tier a device can SUSTAIN. isConfigSupported only says the
 * encoder accepts a config, not that it keeps up (a laptop can accept 4K and
 * still drop a third of its frames), so each tier gets one flat-out synthetic
 * encode, cached per device. Largest tier first, first pass wins.
 *
 * Warm-up frames are excluded from the rate: the startup grace buffer covers the
 * cold-start ramp, and counting it would fail every device on its first run.
 * Imports nothing so the unit tests can load it alone.
 */
export const TARGET_FPS = 30
export const SUSTAIN_FACTOR = 1.25
export const WARMUP_FRAMES = 15
export const MEASURE_FRAMES = 60
export const CACHE_KEY = "screenity_encode_ladder_v1"
export const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000

// A passing tier takes about 2 s (an M1 Pro measured 1.6 s for 4K), so one
// still running at 4 s is failing. The ladder gives up at 6 s; unmeasured tiers
// land on 1080p.
export const TIER_TIMEOUT_MS = 4_000
export const TOTAL_BUDGET_MS = 6_000

// Not a verdict on the device: a freshly launched Chrome's hardware encoder
// emits nothing for the first 4 to 5 s, so a 4K-capable machine can time out
// and would be cached as rate 0, stuck below 4K for the cache lifetime.
export const TIMED_OUT = -1

// A runtime encoder error or failed flush. Unlike unsupported (0, a stable
// property of the device) it can be transient, e.g. the hardware encoder slot
// held by a starting recording, so it fails this load and is never cached.
export const RUN_FAILED = -2

// Timeouts get a short negative cache so a marginal device does not rerun a
// 4 to 6 s speed test on every injected iframe load. It is only ever read as
// "failed", never as a pass. The key hangs off CACHE_KEY so a version bump
// invalidates both.
export const TIMEOUT_CACHE_KEY = `${CACHE_KEY}_timeouts`
export const TIMEOUT_TTL_MS = 6 * 60 * 60 * 1000

export const TIERS = [
  { tier: "2160p", width: 3840, height: 2160, bitrate: 24_000_000 },
  { tier: "1440p", width: 2560, height: 1440, bitrate: 20_000_000 },
  { tier: "1080p", width: 1920, height: 1080, bitrate: 16_000_000 },
]

// Tiers no larger than maxTier; no maxTier means all of them. A 1080p-capped
// account has no use for a 4K or 1440p test.
export const tiersUpTo = (maxTier) => {
  const i = TIERS.findIndex((t) => t.tier === maxTier)
  return i < 0 ? TIERS : TIERS.slice(i)
}

// 30 fps keeps the bare tier name so results cached before 60 fps stay valid.
export const rateKey = (tier, fps = TARGET_FPS) =>
  fps === TARGET_FPS ? tier : `${tier}@${fps}`

// Twice the frames need roughly 1.5x the bits.
export const bitrateAtFps = (bitrate, fps = TARGET_FPS) =>
  fps > TARGET_FPS ? Math.round(bitrate * 1.5) : bitrate

export const passes = (rate, fps = TARGET_FPS, factor = SUSTAIN_FACTOR) =>
  Number.isFinite(rate) && rate >= fps * factor

// At 30 fps 1080p is the floor, returned even when unmeasured or failing (a slow
// 1080p beats refusing to record). Above 30 there is no floor: null means use
// the 30 fps ladder.
export const pickTier = (rates = {}, opts = {}) => {
  const fps = opts.fps ?? TARGET_FPS
  for (const t of tiersUpTo(opts.maxTier)) {
    if (fps === TARGET_FPS && t.tier === "1080p") break
    if (passes(rates[rateKey(t.tier, fps)], fps, opts.factor)) {
      return { ...t, fps }
    }
  }
  return fps === TARGET_FPS ? { ...TIERS[TIERS.length - 1], fps } : null
}

// A new GPU, driver or browser build changes what the encoder can do, so any of
// them invalidates a cached result.
export const deviceKey = () => {
  if (typeof navigator === "undefined") return "unknown"
  return [navigator.userAgent, navigator.hardwareConcurrency].join("|")
}

export const readCache = (storage, now = Date.now(), key = deviceKey()) => {
  try {
    const raw = storage?.getItem(CACHE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    if (v?.key !== key || !(now - v.at < CACHE_TTL_MS)) return null
    return v.rates && typeof v.rates === "object" ? v.rates : null
  } catch {
    return null
  }
}

export const writeCache = (storage, rates, now = Date.now(), key = deviceKey()) => {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify({ key, at: now, rates }))
  } catch {}
}

// Rate in fps; 0 means unsupported, RUN_FAILED a runtime error, TIMED_OUT out of
// time. Never throws.
export const measureEncodeRate = async (
  { width, height, bitrate },
  { fps = TARGET_FPS, timeoutMs = 15_000, codecFor } = {}
) => {
  try {
    if (
      typeof VideoEncoder === "undefined" ||
      typeof VideoFrame === "undefined" ||
      typeof OffscreenCanvas === "undefined"
    ) {
      return 0
    }
    const config = {
      // codecFor lifts the AVC level for large frames (media/avcLevel); the
      // fallback is level 5.1, which every tier fits.
      codec: codecFor ? codecFor("avc1.64002A", width, height, fps) : "avc1.640033",
      width,
      height,
      bitrate,
      framerate: fps,
      hardwareAcceleration: "prefer-hardware",
      latencyMode: "realtime",
    }
    const support = await VideoEncoder.isConfigSupported(config)
    if (!support?.supported) return 0

    // Two distinct frames keep the encoder off a static image; each 4K canvas is
    // about 33 MB.
    const sources = Array.from({ length: 2 }, (_, i) => {
      const c = new OffscreenCanvas(width, height)
      const g = c.getContext("2d")
      g.fillStyle = `hsl(${(i * 47) % 360},70%,50%)`
      g.fillRect(0, 0, width, height)
      g.fillStyle = "#fff"
      for (let k = 0; k < 30; k += 1) {
        g.fillRect(
          (i * 53 + k * 97) % width,
          (k * 71 + i * 29) % height,
          width / 8,
          height / 12
        )
      }
      return c
    })

    let failed = false
    const encoder = new VideoEncoder({
      output: () => {},
      error: () => {
        failed = true
      },
    })
    encoder.configure(config)

    const frameUs = Math.round(1_000_000 / fps)
    const total = WARMUP_FRAMES + MEASURE_FRAMES
    let sent = 0
    let measureStart = 0
    const deadline = performance.now() + timeoutMs
    // flush() can hang on a struggling encoder, so race it. Resolves true
    // (flushed), false (encoder error) or null (deadline).
    const flushBy = async () => {
      const done = encoder.flush().then(
        () => true,
        () => false
      )
      const late = new Promise((r) =>
        setTimeout(() => r(null), Math.max(0, deadline - performance.now()))
      )
      return Promise.race([done, late])
    }
    try {
      while (sent < total && !failed) {
        if (performance.now() > deadline) return TIMED_OUT
        if (encoder.encodeQueueSize > 6) {
          await new Promise((r) => setTimeout(r, 1))
          continue
        }
        if (sent === WARMUP_FRAMES) {
          const warmFlush = await flushBy()
          if (warmFlush === null) return TIMED_OUT
          if (!warmFlush) return RUN_FAILED
          measureStart = performance.now()
        }
        const frame = new VideoFrame(sources[sent % sources.length], {
          timestamp: sent * frameUs,
        })
        encoder.encode(frame, { keyFrame: sent % 60 === 0 })
        frame.close()
        sent += 1
      }
      const finalFlush = await flushBy()
      if (finalFlush === null) return TIMED_OUT
      if (!finalFlush) return RUN_FAILED
    } finally {
      try {
        encoder.close()
      } catch {}
    }
    if (failed || !measureStart) return RUN_FAILED
    const seconds = (performance.now() - measureStart) / 1000
    return seconds > 0 ? MEASURE_FRAMES / seconds : RUN_FAILED
  } catch {
    return RUN_FAILED
  }
}

// Rate keys that timed out within the TTL for this device.
export const readTimeouts = (storage, now = Date.now(), key = deviceKey()) => {
  try {
    const raw = storage?.getItem(TIMEOUT_CACHE_KEY)
    if (!raw) return {}
    const v = JSON.parse(raw)
    if (v?.key !== key || !v.at || typeof v.at !== "object") return {}
    return Object.fromEntries(
      Object.entries(v.at).filter(
        ([, t]) => Number.isFinite(t) && t <= now && now - t < TIMEOUT_TTL_MS
      )
    )
  } catch {
    return {}
  }
}

export const writeTimeouts = (storage, at, now = Date.now(), key = deviceKey()) => {
  try {
    storage?.setItem(TIMEOUT_CACHE_KEY, JSON.stringify({ key, at }))
  } catch {}
}

// Measures only what the cache lacks; a capable machine runs one test. With
// preferFps above 30 it tries those tiers first, then the 30 fps ladder.
export const resolveSustainedTier = async ({
  measure = measureEncodeRate,
  storage = typeof localStorage === "undefined" ? null : localStorage,
  now = Date.now(),
  key = deviceKey(),
  preferFps = TARGET_FPS,
  maxTier,
  budgetMs = TOTAL_BUDGET_MS,
  tierTimeoutMs = TIER_TIMEOUT_MS,
  clock = () => performance.now(),
} = {}) => {
  const budgetEnd = clock() + budgetMs
  const rates = { ...(readCache(storage, now, key) || {}) }
  let changed = false
  // Timed out or failed at runtime: counts as failed this load, never cached.
  const skipped = new Set()
  const timeouts = readTimeouts(storage, now, key)
  let timeoutsChanged = false
  const sweep = async (fps) => {
    for (const t of tiersUpTo(maxTier)) {
      if (fps === TARGET_FPS && t.tier === "1080p") break
      const k = rateKey(t.tier, fps)
      if (!(k in rates) && k in timeouts) {
        // Timed out recently: failed without re-measuring.
        rates[k] = 0
        skipped.add(k)
      } else if (!(k in rates)) {
        const left = budgetEnd - clock()
        if (left <= 0) break
        const timeoutMs = Math.min(tierTimeoutMs, left)
        const rate = await measure(
          { ...t, bitrate: bitrateAtFps(t.bitrate, fps) },
          { fps, timeoutMs }
        )
        if (rate === TIMED_OUT || rate === RUN_FAILED) {
          rates[k] = 0
          skipped.add(k)
          // A run cut short by the total budget says nothing about the tier.
          const cutShort = timeoutMs < tierTimeoutMs
          if (rate === TIMED_OUT && !cutShort) {
            timeouts[k] = now
            timeoutsChanged = true
          }
          if (rate === TIMED_OUT && cutShort) break
          continue
        }
        rates[k] = rate
        changed = true
      }
      if (passes(rates[k], fps)) break
    }
  }
  let picked = null
  if (preferFps > TARGET_FPS) {
    await sweep(preferFps)
    picked = pickTier(rates, { fps: preferFps, maxTier })
  }
  if (!picked) {
    await sweep(TARGET_FPS)
    picked = pickTier(rates, { fps: TARGET_FPS, maxTier })
  }
  if (timeoutsChanged) writeTimeouts(storage, timeouts, now, key)
  if (changed) {
    const cacheable = Object.fromEntries(
      Object.entries(rates).filter(([k]) => !skipped.has(k))
    )
    writeCache(storage, cacheable, now, key)
  }
  return { ...picked, rates }
}
