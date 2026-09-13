// Keeps a finished recording safe from the next recording's cleanup while its
// editor tab is open. Closing the tab drops the protection, never the bytes.
// Logged out only: a signed-in recording is already uploaded.
import {
  CHUNK_SLOT_A,
  CHUNK_SLOT_B,
  instanceForSlot,
} from "../../utils/chunkStores";

const KEY = "retainedRecordings";
// Below this much free space retention yields. A recording nobody can write
// beats a spare copy of an old one.
const MIN_FREE_BYTES = 2 * 1024 * 1024 * 1024;

const read = async () => {
  try {
    const got = await chrome.storage.local.get([KEY]);
    return Array.isArray(got?.[KEY]) ? got[KEY] : [];
  } catch {
    return [];
  }
};

const write = async (list) => {
  try {
    await chrome.storage.local.set({ [KEY]: list });
  } catch {}
};

// chrome.tabs.get, never a ping. A discarded or suspended tab still exists and
// will restore, but its page runs no script.
const tabExists = async (tabId) => {
  if (typeof tabId !== "number") return false;
  try {
    const tab = await chrome.tabs.get(tabId);
    return Boolean(tab);
  } catch {
    return false;
  }
};

const isLoggedIn = async () => {
  try {
    const got = await chrome.storage.local.get(["isLoggedIn"]);
    return got?.isLoggedIn === true;
  } catch {
    return false;
  }
};

const hasHeadroom = async () => {
  try {
    if (!navigator.storage?.estimate) return true;
    const { quota, usage } = await navigator.storage.estimate();
    if (!Number.isFinite(quota) || !Number.isFinite(usage)) return true;
    return quota - usage > MIN_FREE_BYTES;
  } catch {
    // Matches the existing low-storage treatment. An estimate that throws
    // counts as pressure rather than assumed healthy.
    return false;
  }
};

export const registerRetainable = async (entry) => {
  if (!entry || typeof entry.tabId !== "number") return;
  // An IDB recording has neither a recordingId nor a file name, so it takes
  // its identity from the tab holding it.
  const id =
    entry.recordingId || entry.fileName || `tab:${entry.tabId}`;
  if (await isLoggedIn()) return;
  const list = await read();
  const next = list.filter((e) => e.recordingId !== id && e.tabId !== entry.tabId);
  next.push({
    recordingId: id,
    backend: entry.backend || null,
    fileName: entry.fileName || null,
    // IDB only. An OPFS entry carrying one makes callers read the live slot as
    // busy and skip a recording that is free to recover.
    slot: entry.backend === "opfs" ? null : entry.slot || null,
    tabId: entry.tabId,
    durationMs: Number(entry.durationMs) || 0,
    saved: false,
    at: Date.now(),
  });
  await write(next);
};

// A download or Drive save means the user has their own copy, so this stops
// being protected and stops being warned about.
export const markRetainedSaved = async (recordingId, tabId = null) => {
  const list = await read();
  // The stop-tab route has no recordingId, so fall back to the reporting tab,
  // which registerRetainable stored. No newest-unsaved guess: it marked an
  // unrelated recording saved and let the next take destroy it.
  const target =
    (recordingId && list.find((e) => e.recordingId === recordingId)) ||
    (typeof tabId === "number" &&
      list.find((e) => e.tabId === tabId && !e.saved)) ||
    null;
  if (!target || target.saved) return;
  await write(
    list.map((e) =>
      e.recordingId === target.recordingId ? { ...e, saved: true } : e,
    ),
  );
};


// No length floor. A short recording can matter as much as a long one, and
// still open and never saved is the whole condition.
export const PROMPT_MIN_DURATION_MS = 0;

// The dismissal expires. The button never said forever, and this is the only
// warning before an unsaved recording is destroyed.
const PROMPT_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const unsavedRetained = async () => {
  if (await isLoggedIn()) return null;
  try {
    const { unsavedRecordingPromptDismissed: dismissedAt } =
      await chrome.storage.local.get(["unsavedRecordingPromptDismissed"]);
    if (
      typeof dismissedAt === "number" &&
      Date.now() - dismissedAt < PROMPT_DISMISS_TTL_MS
    ) {
      return null;
    }
  } catch {}
  const alive = await pruneRetained();
  // Not gated on whether they played or scrubbed it. Still open and never saved
  // is enough, better asked once too often than lost.
  return alive.find((e) => !e.saved) || null;
};

// Drop entries whose editor tab is gone. Does not delete any bytes.
export const pruneRetained = async () => {
  const list = await read();
  // In parallel. This sits on the record-start path, and a pile of open editors
  // would otherwise cost one round trip each before recording.
  const live = await Promise.all(list.map((e) => tabExists(e.tabId)));
  const alive = list.filter((_, i) => live[i]);
  if (alive.length !== list.length) await write(alive);
  return alive;
};

// What the next recording may keep. `keepNames` are OPFS files to skip,
// `retainSlot` is the IDB slot to leave alone so the new one takes the other.
export const computeRetentionPlan = async () => {
  const empty = { keepNames: [], retainSlot: null, activeSlot: CHUNK_SLOT_A };
  // The common case, and this sits on the start path. One storage read before
  // the estimate and the tab lookups.
  if (!(await read()).length) return empty;
  if (await isLoggedIn()) return empty;
  if (!(await hasHeadroom())) return empty;

  const alive = await pruneRetained();
  if (!alive.length) return empty;

  // Saved means they already have the file, so its editor closes and its bytes
  // release exactly as before retention existed.
  const unsaved = alive.filter((e) => !e.saved);
  const opfs = unsaved.filter((e) => e.backend === "opfs" && e.fileName);
  const keepNames = opfs.map((e) => e.fileName);

  // Only one IDB recording survives: two slots, and the new recording needs
  // one. Newest wins. A null backend predates the ref and can only be IDB.
  const idb = unsaved
    .filter((e) => (e.backend === "idb" || !e.backend) && e.slot)
    .sort((a, b) => b.at - a.at)[0];
  const retainSlot = idb ? idb.slot : null;
  const activeSlot = !retainSlot
    ? CHUNK_SLOT_A
    : retainSlot === CHUNK_SLOT_A
      ? CHUNK_SLOT_B
      : CHUNK_SLOT_A;

  return { keepNames, retainSlot, activeSlot };
};

// The chunk slot the editor in this tab owns, if it is a retained IDB one.
export const slotForTab = async (tabId) => {
  if (typeof tabId !== "number") return null;
  const list = await read();
  const mine = list.find((e) => e.tabId === tabId);
  return mine?.slot || null;
};

// Separates "this tab owns no retained recording" from "it owns one holding no
// IDB slot". The Drive fallback rebuilds from IDB and must tell them apart.
export const retainedEntryForTab = async (tabId) => {
  if (typeof tabId !== "number") return null;
  const list = await read();
  return list.find((e) => e.tabId === tabId) || null;
};

// Only drops the registry entry. Bytes stay until the next cleanup.
export const forgetRetained = async (tabId) => {
  const list = await read();
  const next = list.filter((e) => e.tabId !== tabId);
  if (next.length !== list.length) await write(next);
};

// Runs at session start, before the recorder page exists. It prewarms by
// clearing the chunk store, and a later plan is read after that clear.
export const applyRetentionPlan = async () => {
  const plan = await computeRetentionPlan();
  await chrome.storage.local.set({
    retentionPlan: plan,
    activeChunkSlot: plan.activeSlot,
  });
  reclaimIdleSlot(plan).catch(() => {});
  return plan;
};

// Empty the slot that is neither written to nor retained. The recorder only
// clears the slot it writes, so otherwise a whole recording sits there forever.
export const reclaimIdleSlot = async (plan) => {
  // Never while recording. A stale flag costs disk, clearing the slot a live
  // recording writes to costs the recording.
  try {
    const { recording } = await chrome.storage.local.get(["recording"]);
    if (recording === true) return;
  } catch {
    return;
  }
  const active = plan?.activeSlot || CHUNK_SLOT_A;
  const retain = plan?.retainSlot || null;
  const cleared = [];
  for (const slot of [CHUNK_SLOT_A, CHUNK_SLOT_B]) {
    if (slot === active || slot === retain) continue;
    await instanceForSlot(slot).clear();
    cleared.push(slot);
  }
  if (!cleared.length) return;
  // The bytes are gone, so no entry may still name the slot. A ref would send
  // that editor to whichever recording is live now.
  const list = await read();
  let changed = false;
  const next = list.map((e) => {
    if (!e.slot || !cleared.includes(e.slot)) return e;
    changed = true;
    return { ...e, slot: null, bytesGone: true };
  });
  if (changed) await write(next);
};


// Editor tabs the plan actually preserves. Derived from the plan, not the
// registry, so a tab stays open only when the bytes behind it do.
export const retainedTabIdsFor = async (plan) => {
  const keep = new Set(plan?.keepNames || []);
  const active = plan?.activeSlot || null;
  const alive = await pruneRetained();
  return new Set(
    alive
      .filter((e) => !e.saved && typeof e.tabId === "number")
      .filter(
        (e) =>
          (e.backend === "opfs" && e.fileName && keep.has(e.fileName)) ||
          (active && e.slot && e.slot !== active),
      )
      .map((e) => e.tabId),
  );
};
