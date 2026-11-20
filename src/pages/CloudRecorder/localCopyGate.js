// A local byte range is deleted only once the server confirmed it (upload closed) or the user
// discarded the take. Every CloudRecorder cleanup tail asks here first.

const TRACKS = ["screen", "camera", "audio", "mic"];

// tracks: { [name]: { localBytes, confirmed } }. One unconfirmed track holds the whole take:
// resume and Retry need its journal and its siblings.
export const canReleaseLocalCopy = ({ proof, tracks = {} } = {}) => {
  if (proof === "user-discard") return { release: true, held: [] };
  const held = TRACKS.filter((name) => {
    const t = tracks[name];
    return Boolean(t) && Number(t.localBytes) > 0 && t.confirmed !== true;
  });
  return { release: held.length === 0, held };
};

// A tombstone never ages out: nothing in it says the server has the bytes, so
// the take stays held until it is saved, discarded or settled with a receipt.
const journalHolds = (journal) => {
  if (!journal || typeof journal !== "object") return false;
  if (journal.status === "completed") return false;
  return true;
};

const IDB_TRACKS = ["screen", "camera", "audio"];
const trackOf = (journal) => {
  const t = journal?.trackType || journal?.type || "screen";
  return t === "camera" || t === "audio" ? t : "screen";
};

// IDB is one store per track, shared by every take that falls back to it. A take with an
// unreleased copy there owns it until resume, Retry or a discard settles it.
// One entry per held track: { sessionId, track, journal, snapshotTrack, tagged, mark }.
export const heldIdbTracks = (
  storage = {},
  {
    excludeSessionId = null,
    recoverableStatuses = new Set(),
    now = Date.now(),
  } = {}
) => {
  const discarded = new Set(
    Array.isArray(storage.discardedRecordingSessionIds)
      ? storage.discardedRecordingSessionIds
      : []
  );
  const snapshot = (id) => storage[`cloudRecorderSession:${id}`] || null;
  // A journal with no snapshot says nothing about where its chunks went, so it
  // holds nothing here. Older snapshots predate OPFS and never recorded one.
  const backendOf = (session, track) => {
    if (!session) return null;
    const backends = session.storageBackends;
    if (!backends) return "idb";
    return backends[track] || "idb";
  };
  const held = new Map();
  const add = (id, track, journal) => {
    const key = `${id}:${track}`;
    const prior = held.get(key);
    if (
      prior?.journal &&
      !(Number(journal?.totalBytes) > Number(prior.journal.totalBytes || 0))
    )
      return;
    const session = snapshot(id);
    held.set(key, {
      sessionId: id,
      track,
      journal: journal || prior?.journal || null,
      snapshotTrack: session?.tracks?.[track] || null,
      tagged: session?.chunksTagged === true,
      mark: storage[`chunkPurgeMarks:${id}`]?.[track] || null,
    });
  };
  // A discard stamps the snapshot first, so a take it reached is not a refusal
  // even when clearing its stores failed part way.
  const skip = (id) =>
    !id ||
    id === excludeSessionId ||
    discarded.has(id) ||
    Number(snapshot(id)?.discardedAt || 0) > 0 ||
    // Only a take the server confirmed byte for byte (awaiting-confirm, held after the checks ran
    // out) is released by the start. A crash-recovered unconfirmed take keeps owning the store.
    (snapshot(id)?.status === "awaiting-confirm" &&
      snapshot(id)?.heldReason === "unconfirmed");
  for (const [key, value] of Object.entries(storage)) {
    if (!key.startsWith("uploadJournal-")) continue;
    const id = value?.sessionId;
    if (skip(id) || !journalHolds(value)) continue;
    const track = trackOf(value);
    if (backendOf(snapshot(id), track) === "idb") add(id, track, value);
  }
  for (const [key, value] of Object.entries(storage)) {
    if (!key.startsWith("cloudRecorderSession:")) continue;
    const id = value?.id;
    // A take waiting on Bunny is not held; once a check held it (rejected,
    // short) its copy is the only one left and it owns the store like any other.
    const heldWhileAwaiting =
      value.status === "awaiting-confirm" && value.holdUntilRecovered === true;
    if (skip(id) || !(recoverableStatuses.has(value.status) || heldWhileAwaiting)) continue;
    for (const track of IDB_TRACKS) {
      if (backendOf(value, track) === "idb" && !held.has(`${id}:${track}`)) {
        add(id, track, null);
      }
    }
  }
  return [...held.values()];
};

// Whether an earlier take left a journal still holding its local copy, on any backend.
// Telemetry only: counts how often a start meets a take that did not finish.
export const priorJournalIncomplete = (
  storage = {},
  { excludeSessionId = null, now = Date.now() } = {}
) => {
  const discarded = new Set(
    Array.isArray(storage.discardedRecordingSessionIds)
      ? storage.discardedRecordingSessionIds
      : []
  );
  for (const [key, value] of Object.entries(storage)) {
    if (!key.startsWith("uploadJournal-")) continue;
    const id = value?.sessionId;
    if (!id || id === excludeSessionId || discarded.has(id)) continue;
    if (journalHolds(value)) return true;
  }
  return false;
};

export const findHeldIdbTakes = (storage = {}, opts = {}) => [
  ...new Set(heldIdbTracks(storage, opts).map((t) => t.sessionId)),
];

// Whether a store's chunks ([{ index, size, sessionId? }], sorted) are this take's copy. A store
// another take wrote over, even partly, is not. Untagged chunks (local Recorder or pre-tagging)
// never belong to a tagged take, and to a legacy take only while it is the latest, as on master.
export const storeHoldsTake = (
  entries = [],
  { sessionId = null, latestSessionId = null, mark = null, tagged = false } = {}
) => {
  if (!sessionId) return false;
  const tail = unsentChunks(entries, mark);
  if (tail.length === 0) return false;
  return tail.every((c) => writtenBy(c, { sessionId, latestSessionId, tagged }));
};

// Chunks up to a purge mark are already on the server.
const unsentChunks = (entries, mark) => {
  const firstIndex = mark ? Number(mark.index) + 1 : 0;
  return entries.filter((c) => c.index >= firstIndex);
};

const writtenBy = (c, { sessionId, latestSessionId, tagged }) =>
  c.sessionId
    ? c.sessionId === sessionId
    : !tagged && sessionId === latestSessionId;

// Whether a store still has any chunk of this take past its mark. Even one
// sitting among chunks other takes wrote may be the only copy of those bytes.
export const storeHasTakeChunks = (
  entries = [],
  { sessionId = null, latestSessionId = null, mark = null, tagged = false } = {}
) =>
  Boolean(sessionId) &&
  unsentChunks(entries, mark).some((c) =>
    writtenBy(c, { sessionId, latestSessionId, tagged })
  );

// The held take with chunks in one IDB track store, or null. Clearing or
// writing over that store would lose them.
export const idbStoreOwner = (
  entries,
  track,
  held = [],
  { latestSessionId = null } = {}
) => {
  for (const h of held) {
    if (
      h.track === track &&
      storeHasTakeChunks(entries, {
        sessionId: h.sessionId,
        latestSessionId,
        mark: h.mark,
        tagged: h.tagged === true,
      })
    ) {
      return h.sessionId;
    }
  }
  return null;
};

export const summarizeStore = async (store, prefix) => {
  const out = [];
  await store.iterate((value, key) => {
    if (!String(key).startsWith(prefix)) return undefined;
    const index =
      typeof value?.index === "number"
        ? value.index
        : parseInt(String(key).slice(prefix.length), 10);
    if (Number.isFinite(index)) {
      const entry = { index, size: Number(value?.chunk?.size) || 0 };
      if (typeof value?.sessionId === "string") entry.sessionId = value.sessionId;
      out.push(entry);
    }
    return undefined;
  });
  return out.sort((a, b) => a.index - b.index);
};

// The recorder beats cloudRecorderHostBusy every 15 s through the post-stop
// drain. Same TTL as resumePendingUploads.
export const HOST_BUSY_TTL_MS = 90 * 1000;

const STUCK_SESSION_STATUSES = new Set([
  "finalize-failed",
  "crashed",
  "stale-cleared",
  "unload",
]);

const ACTIVE_JOURNAL = new Set([
  "uploading",
  "paused",
  "pending",
  "starting",
  "finalizing",
]);

// A host with no session of its own (a waiting start) must not overwrite a live session's beat:
// the single key is what tells this drain apart from a dead one.
export const shouldWriteBeat = (existing, mySessionId, now = Date.now()) => {
  if (mySessionId) return true;
  if (!existing || !existing.sessionId) return true;
  return now - Number(existing.at || 0) >= HOST_BUSY_TTL_MS;
};

// "progressing" (host alive and draining), "held" (needs Recover or Discard) or "none". Host
// liveness decides, not journal freshness: updatedAt stalls during a slow PATCH or offline pause.
// ownedTracks (optional) limits this to tracks with this take's chunks; mic-only entries never force held.
export const classifyHeldTake = (
  storage = {},
  sessionId,
  { now = Date.now(), recoverableStatuses = new Set(), ownedTracks = null } = {}
) => {
  let entries = heldIdbTracks(storage, { now, recoverableStatuses }).filter(
    (h) => h.sessionId === sessionId
  );
  if (ownedTracks) entries = entries.filter((h) => ownedTracks.has(h.track));
  if (entries.length === 0) return "none";
  // A hold stored on the snapshot is the settle saying the bytes need the user.
  if (storage[`cloudRecorderSession:${sessionId}`]?.holdUntilRecovered === true) {
    return "held";
  }
  // A host still beating does not make a take that failed progress.
  const snapStatus = storage[`cloudRecorderSession:${sessionId}`]?.status;
  if (STUCK_SESSION_STATUSES.has(snapStatus)) return "held";
  const journals = entries.map((h) => h.journal).filter(Boolean);
  if (journals.length === 0) return "held";
  const bad = journals.some(
    (j) => j.holdUntilRecovered === true || !ACTIVE_JOURNAL.has(j.status)
  );
  if (bad) return "held";
  const beat = storage.cloudRecorderHostBusy;
  const alive =
    beat &&
    beat.sessionId === sessionId &&
    now - Number(beat.at || 0) < HOST_BUSY_TTL_MS;
  return alive ? "progressing" : "held";
};

// The IDB slots a local run can write to. A slot is out if a held take owns it
// or the retained recording does. null means neither is free.
export const pickWriteSlot = ({ retainSlot = null, heldSlots = [] } = {}) => {
  const taken = new Set([retainSlot, ...heldSlots].filter(Boolean));
  return ["chunks", "chunks_b"].find((s) => !taken.has(s)) || null;
};

// The slot the next local run writes to. Only slot A can hold a cloud take (CloudRecorder writes
// "chunks" only). A retained local recording is never a fallback: if only its slot is free, the
// active slot stays on the held one so the guarded clear refuses the start.
export const planActiveSlot = ({
  retainSlot = null,
  heldSlots = [],
  current = "chunks",
} = {}) => {
  if (heldSlots.length === 0) return current;
  return pickWriteSlot({ retainSlot, heldSlots }) || heldSlots[0];
};

export const clearSlotUnlessHeld = async (
  store,
  {
    storage = {},
    recoverableStatuses = new Set(),
    now = Date.now(),
    slot = null,
  } = {}
) => {
  const held = heldIdbTracks(storage, { recoverableStatuses, now });
  if (held.length > 0) {
    const entries = await summarizeStore(store, "chunk_");
    // A cloud take never wrote slot B, so the legacy "untagged chunks belong
    // to the latest take" claim only applies to slot A (or an unknown slot).
    const latest =
      slot && slot !== "chunks" ? null : storage.recorderSession?.id || null;
    const owner = idbStoreOwner(entries, "screen", held, {
      latestSessionId: latest,
    });
    if (owner) return { cleared: false, owner };
  }
  await store.clear();
  return { cleared: true, owner: null };
};

export const HELD_WAIT_MS = 30 * 1000;
const HELD_POLL_MS = 2000;

// A start blocked by another take's copy waits up to timeoutMs for a progressing upload.
// Resolves "clear", "progressing" or "held". owner() -> session id or null; classify(id) -> kind.
export const waitForHeldTake = async ({
  owner,
  classify,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  timeoutMs = HELD_WAIT_MS,
  pollMs = HELD_POLL_MS,
  onClear = null,
} = {}) => {
  let waited = 0;
  let sawOwner = false;
  // A start that had an owner and now is clear: the caller can undo whatever
  // it steered away from the held slot meanwhile.
  const clear = async () => {
    if (sawOwner && onClear) await onClear();
    return "clear";
  };
  for (;;) {
    const id = await owner();
    if (!id) return clear();
    sawOwner = true;
    const kind = await classify(id);
    if (kind === "none") return clear();
    if (kind === "held") return "held";
    if (waited >= timeoutMs) return "progressing";
    await sleep(pollMs);
    waited += pollMs;
  }
};

// Statuses a take can be left in while its copy is still the only one. stale-cleared and crashed
// are what a toolbar click or a closed recorder tab rewrite a crashed take to.
export const RECOVERABLE_SESSION_STATUSES = new Set([
  "recording",
  "hidden",
  "unload",
  "stopping",
  "finalize-failed",
  "upload-stalled",
  "stale-cleared",
  "crashed",
]);

// Every local-run clear of a shared chunk store goes through here. Returns { cleared, owner, kind };
// kind is "progressing" or "held" when a cloud take owns the store, so the caller picks the modal.
// slot: "chunks" | "chunks_b", or an async resolver for the active-slot proxy.
export const guardedClear = async (store, slot = null) => {
  const slotName = typeof slot === "function" ? await slot() : slot;
  let storage = {};
  try {
    storage = (await chrome.storage.local.get(null)) || {};
  } catch {}
  const res = await clearSlotUnlessHeld(store, {
    storage,
    recoverableStatuses: RECOVERABLE_SESSION_STATUSES,
    slot: slotName,
  });
  if (res.cleared) return { ...res, kind: null };
  return {
    ...res,
    kind: classifyHeldTake(storage, res.owner, {
      recoverableStatuses: RECOVERABLE_SESSION_STATUSES,
      ownedTracks: new Set(["screen"]),
    }),
  };
};

export const heldSlotsFor = async (slots, instanceForSlot) => {
  let storage = {};
  try {
    storage = (await chrome.storage.local.get(null)) || {};
  } catch {}
  const held = heldIdbTracks(storage, {
    recoverableStatuses: RECOVERABLE_SESSION_STATUSES,
  });
  if (held.length === 0) return [];
  const latestSessionId = storage.recorderSession?.id || null;
  const out = [];
  for (const slot of slots) {
    const entries = await summarizeStore(instanceForSlot(slot), "chunk_").catch(
      () => []
    );
    if (idbStoreOwner(entries, "screen", held, { latestSessionId })) {
      out.push(slot);
    }
  }
  return out;
};
