const DEVICE_ID_ERRORS = new Set(["OverconstrainedError", "NotFoundError"]);

const isDeviceIdError = (err) => err && DEVICE_ID_ERRORS.has(err.name);

const cloneConstraints = (constraints) =>
  JSON.parse(JSON.stringify(constraints || {}));

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

export const getUserMediaWithFallback = async ({
  constraints,
  fallbacks = [],
}) => {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
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

    const stream = await navigator.mediaDevices.getUserMedia(nextConstraints);
    resolved.forEach(({ resolvedId, onResolved }) => {
      if (typeof onResolved === "function") {
        onResolved(resolvedId);
      }
    });
    return stream;
  }
};
