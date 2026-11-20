// Same-device rule for a mic reconnect. Chrome labels the system default mic
// "Default - <device>", and the device behind it can change, so for the
// default/communications ids only the prefix has to match. An explicit device
// id needs the exact label.
const PREFIX_BY_ID = {
  default: "Default - ",
  communications: "Communications - ",
};

export function isSameMicDevice({ deviceId, previousLabel, newLabel }) {
  if (!previousLabel) return true;
  if (newLabel === previousLabel) return true;
  const prefix = PREFIX_BY_ID[deviceId];
  return Boolean(prefix && String(newLabel || "").startsWith(prefix));
}

// One level probe per source: dispose the old one before swapping in the new.
export function replaceProbe(probes, key, create) {
  if (!probes) return;
  try {
    probes[key]?.dispose?.();
  } catch {}
  probes[key] = create();
}
