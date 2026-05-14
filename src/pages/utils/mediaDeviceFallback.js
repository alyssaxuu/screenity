const DEVICE_ID_ERRORS = new Set(["OverconstrainedError", "NotFoundError"]);

const isDeviceIdError = (err) => err && DEVICE_ID_ERRORS.has(err.name);

// Bluetooth/USB audio devices commonly return NotReadableError for 1-2s
// after wake/connect while the OS spins up the endpoint. A short retry
// turns the "headphones didn't record" complaint into a one-second pause.
const TRANSIENT_RETRY_DELAYS_MS = [350, 700];
const isTransientReadError = (err) =>
  err && (err.name === "NotReadableError" || err.name === "AbortError");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Constraints can contain nested objects (deviceId.exact) so a deep clone is required.
const cloneConstraints = (constraints) => {
  const src = constraints || {};
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(src);
    } catch {}
  }
  return JSON.parse(JSON.stringify(src));
};

const updateConstraintsDeviceId = (constraints, kind, deviceId) => {
  if (!constraints || !deviceId) return;

  if (kind === "audioinput") {
    if (!constraints.audio || typeof constraints.audio !== "object") return;
    constraints.audio = {
      ...constraints.audio,
      deviceId: { exact: deviceId },
    };
    return;
  }

  if (kind === "videoinput") {
    if (!constraints.video || typeof constraints.video !== "object") return;
    constraints.video = {
      ...constraints.video,
      deviceId: { exact: deviceId },
    };
  }
};

export const enumerateCurrentDevices = async () => {
  try {
    return await navigator.mediaDevices.enumerateDevices();
  } catch (err) {
    console.warn("Failed to enumerate devices:", err);
    return [];
  }
};

export const resolveDeviceIdByLabel = async (kind, desiredLabel) => {
  if (!desiredLabel) return null;
  const devices = await enumerateCurrentDevices();
  const matches = devices.filter(
    (device) => device.kind === kind && device.label === desiredLabel
  );
  if (matches.length !== 1) return null;
  return matches[0].deviceId;
};

const attemptGetUserMediaWithTransientRetry = async (constraints) => {
  let lastErr = null;
  const attempts = [0, ...TRANSIENT_RETRY_DELAYS_MS];
  for (let i = 0; i < attempts.length; i += 1) {
    if (attempts[i] > 0) await sleep(attempts[i]);
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
      // Permission/overconstrained errors must bail immediately so
      // callers can run their label fallback or surface the prompt.
      if (!isTransientReadError(err)) break;
    }
  }
  throw lastErr;
};

export const getUserMediaWithFallback = async ({
  constraints,
  fallbacks = [],
}) => {
  try {
    return await attemptGetUserMediaWithTransientRetry(constraints);
  } catch (err) {
    if (!isDeviceIdError(err) || fallbacks.length === 0) {
      throw err;
    }

    const nextConstraints = cloneConstraints(constraints);
    const resolved = [];

    for (const fallback of fallbacks) {
      const { kind, desiredLabel, desiredDeviceId } = fallback || {};
      if (!kind || !desiredLabel || !desiredDeviceId) continue;
      const resolvedId = await resolveDeviceIdByLabel(kind, desiredLabel);
      if (!resolvedId || resolvedId === desiredDeviceId) continue;
      updateConstraintsDeviceId(nextConstraints, kind, resolvedId);
      resolved.push({ ...fallback, resolvedId });
    }

    if (resolved.length === 0) {
      throw err;
    }

    console.warn(
      "[Screenity] Retrying getUserMedia with label-matched device IDs"
    );

    const stream = await attemptGetUserMediaWithTransientRetry(
      nextConstraints,
    );
    resolved.forEach(({ resolvedId, onResolved }) => {
      if (typeof onResolved === "function") {
        onResolved(resolvedId);
      }
    });
    return stream;
  }
};
