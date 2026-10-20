const STORAGE_KEY = "cloudUploadTelemetryEvents";
const MAX_EVENTS = 300;
// Each write rewrites the whole list into every tab's onChanged listeners.
// upload_progress fires every few seconds for the whole take, so it waits for
// the next other event or this long, whichever comes first. Order is kept.
export const PROGRESS_FLUSH_MS = 15000;

let writeChain = Promise.resolve();
let queue = [];
let flushTimer = null;

const isProgressEvent = (event) =>
  (event?.event || event?.type) === "upload_progress";

const flushQueue = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  const job = writeChain.then(async () => {
    const existing = await chrome.storage.local.get([STORAGE_KEY]);
    const current = Array.isArray(existing?.[STORAGE_KEY])
      ? existing[STORAGE_KEY]
      : [];
    const next = [...current, ...batch.map((b) => b.event)].slice(-MAX_EVENTS);
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
  });
  writeChain = job.catch(() => {});
  job.then(
    () => batch.forEach((b) => b.resolve(true)),
    (err) => {
      // Don't throw (telemetry can't break recording), but log loudly: silent
      // event loss is the bug this serializer was added to fix.
      console.warn(
        "[serializedTelemetryStore] write failed; events lost:",
        err?.message || err,
        { eventTypes: batch.map((b) => b.event?.event || b.event?.type || null) },
      );
      batch.forEach((b) => b.resolve(false));
    },
  );
};

// Other events resolve once they (and any queued progress before them) are in
// storage. A progress event resolves on queueing: the recorder's close path
// waits on in-flight telemetry and must not sit out the batching window.
export const appendUploadTelemetryEventSerialized = (event) => {
  if (!event || typeof event !== "object") return Promise.resolve(false);
  return new Promise((resolve) => {
    queue.push({ event, resolve });
    if (!isProgressEvent(event)) {
      flushQueue();
      return;
    }
    resolve(true);
    if (!flushTimer) flushTimer = setTimeout(flushQueue, PROGRESS_FLUSH_MS);
  });
};
