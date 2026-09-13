// Two IDB chunk slots, so a finished recording survives the next one: the new
// recording writes to the free slot.
// Slot A keeps the historic "chunks" name. An update mid-recording must still
// find its bytes there, so it never changes.
import localforage from "localforage";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

export const CHUNK_SLOT_A = "chunks";
export const CHUNK_SLOT_B = "chunks_b";
export const CHUNK_SLOTS = [CHUNK_SLOT_A, CHUNK_SLOT_B];
const ACTIVE_SLOT_KEY = "activeChunkSlot";

const instances = new Map();
export const instanceForSlot = (slot) => {
  const name = slot === CHUNK_SLOT_B ? CHUNK_SLOT_B : CHUNK_SLOT_A;
  if (!instances.has(name)) {
    instances.set(name, localforage.createInstance({ name }));
  }
  return instances.get(name);
};

// Defaults to A, so any read that lands before the pointer loads hits the
// store every prior version wrote to.
let activeSlot = CHUNK_SLOT_A;

export const getActiveSlot = () => activeSlot;

export const otherSlot = (slot = activeSlot) =>
  slot === CHUNK_SLOT_A ? CHUNK_SLOT_B : CHUNK_SLOT_A;

export const loadActiveSlot = async () => {
  try {
    const stored = await chrome.storage.local.get([ACTIVE_SLOT_KEY]);
    const slot = stored?.[ACTIVE_SLOT_KEY];
    if (slot === CHUNK_SLOT_A || slot === CHUNK_SLOT_B) activeSlot = slot;
  } catch {}
  return activeSlot;
};

export const setActiveSlot = async (slot) => {
  const next = slot === CHUNK_SLOT_B ? CHUNK_SLOT_B : CHUNK_SLOT_A;
  activeSlot = next;
  try {
    await chrome.storage.local.set({ [ACTIVE_SLOT_KEY]: next });
  } catch {}
  return next;
};

// Every context runs its own copy of this module, so follow the pointer
// rather than each one caching a stale answer.
try {
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[ACTIVE_SLOT_KEY]) return;
      const next = changes[ACTIVE_SLOT_KEY].newValue;
      if (next === CHUNK_SLOT_A || next === CHUNK_SLOT_B) activeSlot = next;
    });
  }
} catch {}

// Every method resolves the pointer first, so a call landing before it loads
// cannot hit the wrong store. clear and removeItem re-read it every time.
const ALWAYS_REFRESH = new Set(["clear", "removeItem"]);

let slotReady = null;
const ensureSlot = (prop) => {
  if (ALWAYS_REFRESH.has(prop)) return loadActiveSlot();
  if (!slotReady) slotReady = loadActiveSlot();
  return slotReady;
};

export const activeChunksStore = new Proxy(
  {},
  {
    get(_target, prop) {
      const probe = instanceForSlot(activeSlot)[prop];
      if (typeof probe !== "function") return probe;
      // activeSlot is read after the await, never captured before it.
      return (...args) =>
        ensureSlot(prop).then(() =>
          instanceForSlot(activeSlot)[prop](...args),
        );
    },
  },
);
