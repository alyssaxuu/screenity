// Storage side of the adaptive policy: the server flag as the recorder sees it
// (T-flag), and the per-machine device history of the last takes (T8).
// Pure helpers plus thin chrome.storage wrappers that take the storage object,
// so tests use a fake. Tests: tests/unit/adaptivePolicyStore.test.mjs
// Fails closed: a missing, stale or unreadable value means policy off, history empty.

export const HISTORY_KEY = "adaptivePolicyHistory";
export const HISTORY_MAX = 5;
// A mirrored flag older than this counts as unreachable server: off.
export const FLAG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Stale or unstamped copies are off.
export const policyFlagsFromStorage = (stored, now = Date.now()) => {
  const off = { adaptivePolicy: false, adaptivePolicyThresholds: null };
  if (!stored || stored.adaptivePolicy !== true) return off;
  const at = Number(stored.adaptivePolicyAt);
  if (!Number.isFinite(at) || at > now + 60_000 || now - at > FLAG_MAX_AGE_MS) return off;
  return {
    adaptivePolicy: true,
    adaptivePolicyThresholds: stored.adaptivePolicyThresholds ?? null,
  };
};

const cleanTake = (t) => ({
  id: typeof t?.id === "string" ? t.id.slice(0, 64) : null,
  at: Number.isFinite(t?.at) ? t.at : 0,
  hostLost: t?.hostLost === true,
  startFail: t?.startFail === true,
  micEnded: t?.micEnded === true,
  micEndedUnderLoad: t?.micEndedUnderLoad === true,
  heavyLoad: t?.heavyLoad === true,
});

export const normalizeHistory = (raw) =>
  Array.isArray(raw) ? raw.filter((t) => t && typeof t === "object").map(cleanTake).slice(-HISTORY_MAX) : [];

// A new take starts clean. Starting the same id twice keeps the first entry.
export const startTake = (history, id, at = Date.now()) => {
  const h = normalizeHistory(history);
  if (id && h.some((t) => t.id === id)) return h;
  return [...h, cleanTake({ id, at })].slice(-HISTORY_MAX);
};

// Set flags on the newest take, or on the one with this id. With no take yet
// the event is dropped.
export const markTake = (history, flags, id = null) => {
  const h = normalizeHistory(history);
  if (!h.length) return h;
  const i = id ? h.findIndex((t) => t.id === id) : h.length - 1;
  if (i < 0) return h;
  const next = h.slice();
  next[i] = cleanTake({ ...next[i], ...pickFlags(flags) });
  return next;
};

const FLAG_NAMES = ["hostLost", "startFail", "micEnded", "micEndedUnderLoad", "heavyLoad"];
const pickFlags = (f) => {
  const out = {};
  for (const k of FLAG_NAMES) if (f && f[k] === true) out[k] = true;
  return out;
};

// Shape sent in the heartbeat and diagnostic report.
export const summarizeHistory = (history) => {
  const h = normalizeHistory(history);
  return {
    takes: h.length,
    hostLost: h.filter((t) => t.hostLost).length,
    startFail: h.filter((t) => t.startFail).length,
    micEnded: h.filter((t) => t.micEnded || t.micEndedUnderLoad).length,
  };
};

export const readHistory = async (storage) => {
  try {
    const got = await storage.get(HISTORY_KEY);
    return normalizeHistory(got?.[HISTORY_KEY]);
  } catch {
    return [];
  }
};

const write = async (storage, next) => {
  try {
    await storage.set({ [HISTORY_KEY]: next });
  } catch {}
  return next;
};

export const recordTakeStart = async (storage, id, at) =>
  write(storage, startTake(await readHistory(storage), id, at));

export const recordTakeEvent = async (storage, flags, id) =>
  write(storage, markTake(await readHistory(storage), flags, id));
