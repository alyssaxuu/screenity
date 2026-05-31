const STORAGE_KEY = "cloudUploadTelemetryEvents";
const MAX_EVENTS = 300;

let writeChain = Promise.resolve();

export const appendUploadTelemetryEventSerialized = async (event) => {
  if (!event || typeof event !== "object") return false;
  const job = writeChain.then(async () => {
    const existing = await chrome.storage.local.get([STORAGE_KEY]);
    const current = Array.isArray(existing?.[STORAGE_KEY])
      ? existing[STORAGE_KEY]
      : [];
    const next = [...current, event].slice(-MAX_EVENTS);
    await chrome.storage.local.set({
      [STORAGE_KEY]: next,
      lastUploadTelemetryEvent: event,
    });
  });
  writeChain = job.catch(() => {});
  try {
    await job;
    return true;
  } catch (err) {
    // Don't throw (telemetry can't break recording), but log loudly: silent
    // event loss is the bug this serializer was added to fix.
    console.warn(
      "[serializedTelemetryStore] write failed; event lost:",
      err?.message || err,
      { eventType: event?.event || event?.type || null },
    );
    return false;
  }
};
