// State when the mic track ended, as numbers, booleans and short enums, to tell
// an unplugged or revoked mic from one starved by load (still listed, permission
// granted, ended seconds after open). Nothing here names the device.

const PERMISSIONS = new Set(["granted", "denied", "prompt"]);

export const buildMicEndContext = ({
  now = Date.now(),
  micAcquiredAt = null,
  countdownEndAt = null,
  deviceId = null,
  devices = null,
  permissionState = null,
} = {}) => {
  const since = (t) => {
    if (!Number.isFinite(t)) return null;
    const ms = now - t;
    return ms >= 0 && ms < 24 * 3_600_000 ? Math.round(ms) : null;
  };
  let micListed = null;
  if (Array.isArray(devices) && deviceId) {
    micListed = devices.some((d) => d?.kind === "audioinput" && d.deviceId === deviceId);
  }
  return {
    micAcquireAgeMs: since(micAcquiredAt),
    countdownEndAgeMs: since(countdownEndAt),
    micListed,
    micPermission: PERMISSIONS.has(permissionState) ? permissionState : null,
  };
};

// Bounded: a probe silent for timeoutMs reads null, so the report is never held.
export const probeMicEnd = async (
  deviceId,
  { mediaDevices = globalThis.navigator?.mediaDevices, permissions = globalThis.navigator?.permissions, timeoutMs = 800 } = {}
) => {
  const bounded = (p) =>
    Promise.race([
      Promise.resolve(p).catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  const [devices, perm] = await Promise.all([
    bounded(mediaDevices?.enumerateDevices?.()),
    bounded(permissions?.query?.({ name: "microphone" })),
  ]);
  return { devices, permissionState: perm?.state ?? null };
};
