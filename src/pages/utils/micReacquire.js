// Mic reconnect window shared by Recorder.jsx (Local) and Region/Recorder.jsx.
// Phase 1 is a short burst of retries through the normal mic acquisition.
// Phase 2 waits for the same device to come back (devicechange events plus a
// slow poll) until a wall-clock deadline. Cloud does not use this.
export const MIC_REACQUIRE_DELAYS_MS = [250, 750, 1500];
export const MIC_REACQUIRE_WINDOW_MS = 30000;
export const MIC_REACQUIRE_POLL_MS = 5000;
// Rate limit for a flapping device, not a total: count drops per window.
export const MIC_REACQUIRE_MAX_PER_WINDOW = 3;
export const MIC_REACQUIRE_RATE_WINDOW_MS = 60000;

// True once the take this retry started for is gone. The generation catches
// discard/stop/restart, which reset or never touch the finishing/recording flags.
export const isMicRetryStale = ({
  generation,
  currentGeneration,
  finishing,
  recording,
}) => currentGeneration !== generation || Boolean(finishing) || !recording;

const stopAll = (stream) => {
  try {
    stream?.getTracks?.().forEach((t) => t.stop());
  } catch {}
};

// The id to retry with. The stored id wins: the first acquisition can resolve a
// drifted id by label and write the new one to storage.
export const resolveMicDeviceId = (storedId, currentId) =>
  storedId && storedId !== "none" ? storedId : currentId;

// Phase 2 acquisition: the exact stored device id and nothing else, so an
// unplugged mic never turns into a different one. Pass getUserMedia in tests.
export const acquireExactMic = (
  deviceId,
  getUserMedia = (c) => navigator.mediaDevices.getUserMedia(c),
  processing = null,
) => {
  if (!deviceId || deviceId === "none") return Promise.resolve(null);
  return getUserMedia({ audio: { deviceId: { exact: deviceId }, ...processing } });
};

const defaultSubscribe = (handler) => {
  const md = typeof navigator !== "undefined" ? navigator.mediaDevices : null;
  if (!md?.addEventListener) return () => {};
  md.addEventListener("devicechange", handler);
  return () => md.removeEventListener("devicechange", handler);
};

const defaultEnumerate = () => navigator.mediaDevices.enumerateDevices();

// Resolves { ok, attempts, reason, gapMs }. reason: "reacquired" | "deadline" |
// "stale" | "wire-failed". gapMs is wall-clock from startedAt to the decision.
//   acquire():       burst acquisition (may fall back inside)
//   acquireExact():  phase 2 acquisition, exact device id only
//   wire(stream, track): connect into the mix, false on failure
//   enumerate / subscribe / now / setTimer / clearTimer: injectable for tests
// The deadline is wall-clock, re-checked at every wake-up plus one timer of its
// own, so a throttled tab cannot run past it unnoticed.
export function reacquireMicWindow({
  acquire,
  acquireExact,
  wire,
  isStale,
  deviceId,
  previousLabel,
  sameDevice = (label) => !previousLabel || label === previousLabel,
  delaysMs = MIC_REACQUIRE_DELAYS_MS,
  windowMs = MIC_REACQUIRE_WINDOW_MS,
  pollMs = MIC_REACQUIRE_POLL_MS,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  enumerate = defaultEnumerate,
  subscribe = defaultSubscribe,
  startedAt = now(),
}) {
  return new Promise((resolve) => {
    const deadline = startedAt + windowMs;
    const timers = new Set();
    let unsubscribe = null;
    let done = false;
    let busy = false;
    let attempts = 0;

    const finish = (ok, reason) => {
      if (done) return;
      done = true;
      timers.forEach((t) => clearTimer(t));
      timers.clear();
      try {
        unsubscribe?.();
      } catch {}
      unsubscribe = null;
      resolve({ ok, attempts, reason, gapMs: now() - startedAt });
    };

    const timer = (fn, ms) => {
      const id = setTimer(() => {
        timers.delete(id);
        fn();
      }, Math.max(0, ms));
      timers.add(id);
      return id;
    };

    // True when the window is over (and has been resolved).
    const over = () => {
      if (done) return true;
      if (isStale()) {
        finish(false, "stale");
        return true;
      }
      if (now() >= deadline) {
        finish(false, "deadline");
        return true;
      }
      return false;
    };

    const armDeadline = () => {
      timer(() => {
        if (over()) return;
        armDeadline();
      }, deadline - now());
    };

    // One attempt. Resolves true when the mic was wired in or the window ended.
    const attempt = async (fn) => {
      if (busy || over()) return done;
      busy = true;
      attempts += 1;
      let result = null;
      try {
        result = await Promise.resolve().then(fn);
      } catch {
        result = null;
      }
      busy = false;
      // A call that lands after the window closed must release the mic.
      if (done || over()) {
        stopAll(result);
        return true;
      }
      const track = result?.getAudioTracks?.()[0];
      if (!track || track.readyState !== "live" || !sameDevice(track.label)) {
        stopAll(result);
        return false;
      }
      let wired = false;
      try {
        wired = wire(result, track) !== false;
      } catch {}
      if (!wired) {
        stopAll(result);
        finish(false, "wire-failed");
        return true;
      }
      finish(true, "reacquired");
      return true;
    };

    const deviceListed = async () => {
      try {
        const list = await enumerate();
        if (!Array.isArray(list)) return true;
        return list.some(
          (d) =>
            d.kind === "audioinput" &&
            (!deviceId || d.deviceId === deviceId),
        );
      } catch {
        return true;
      }
    };

    const tryExact = async () => {
      if (busy || over()) return;
      if (!(await deviceListed())) return;
      await attempt(acquireExact);
    };

    const poll = () => {
      timer(async () => {
        if (over()) return;
        await tryExact();
        if (!done) poll();
      }, pollMs);
    };

    armDeadline();
    (async () => {
      for (const delayMs of delaysMs) {
        await new Promise((r) => timer(r, delayMs));
        if (over()) return;
        if (await attempt(acquire)) return;
      }
      if (over()) return;
      unsubscribe = subscribe(() => {
        tryExact();
      });
      poll();
    })();
  });
}
