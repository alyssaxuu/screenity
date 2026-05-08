// cross-session ring buffer of lifecycle events for state-bleed bugs
// (recordingTab left set, region stuck, etc). per-session detail lives
// in diagnosticLog. ~500 entries in chrome.storage.local, dumped in the
// diag zip. writes serialized through a per-context promise chain.
// entry: { ts, src, ev, data? }

const STORAGE_KEY = "lifecycleLog";
const MAX_EVENTS = 500;

// Serialized so back-to-back lifecycle() calls don't race the read-modify-write.
let _writeChain = Promise.resolve();

const summarize = (data) => {
  if (data === null || data === undefined) return undefined;
  if (typeof data !== "object") return data;
  try {
    const json = JSON.stringify(data);
    if (json.length > 500) {
      return { _truncated: true, preview: json.slice(0, 480) };
    }
    return data;
  } catch {
    return { _serializeError: true };
  }
};

/** Append a lifecycle event. Returns a promise resolved after persist. */
export const lifecycleEvent = async (src, ev, data = null) => {
  const entry = {
    ts: Date.now(),
    src: String(src || "unknown"),
    ev: String(ev || "unknown"),
  };
  const summarized = summarize(data);
  if (summarized !== undefined) entry.data = summarized;

  _writeChain = _writeChain.then(async () => {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      const current = Array.isArray(result?.[STORAGE_KEY])
        ? result[STORAGE_KEY]
        : [];
      current.push(entry);
      while (current.length > MAX_EVENTS) current.shift();
      await chrome.storage.local.set({ [STORAGE_KEY]: current });
    } catch {}
  });
  return _writeChain;
};

/** Fire-and-forget convenience. */
export const lifecycle = (src, ev, data = null) => {
  lifecycleEvent(src, ev, data).catch(() => {});
};

/** For diag zip / inspection. Returns the current buffer. */
export const getLifecycleLog = async () => {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return Array.isArray(result?.[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  } catch {
    return [];
  }
};

/** Wait for any pending writes to flush. */
export const flushLifecycleLog = async () => {
  await _writeChain;
};
