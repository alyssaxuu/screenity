// What the recovery tab does to a held take's stored bytes. Browser access comes in through deps so
// the rules are testable: openStore(track), keyPrefix(track), storeHoldsTake(entries, ctx)
// (localCopyGate), destroySessionDir(opfsSessionId), storage (chrome.storage.local).

// Chunks of one track, sorted, with the header (chunk 0) always first.
export const readTrack = async (take, tr, deps, latestSessionId = null) => {
  const store = deps.openStore(tr);
  const prefix = deps.keyPrefix(tr.track);
  const entries = [];
  await store.iterate((value, key) => {
    if (!String(key).startsWith(prefix) || !value?.chunk) return undefined;
    const index =
      typeof value.index === "number"
        ? value.index
        : parseInt(String(key).slice(prefix.length), 10) || 0;
    entries.push({ index, chunk: value.chunk, sessionId: value.sessionId });
    return undefined;
  });
  entries.sort((a, b) => a.index - b.index);
  // A mic debt has no snapshot to say who wrote the shared audio store, so it
  // is the debt's unless a chunk is tagged by another take.
  if (take.kind === "mic-debt") {
    const own = new Set([take.micSessionId, ...(take.micOwnTags || [])].filter(Boolean));
    const foreign = entries.some(
      (e) => typeof e.sessionId === "string" && !own.has(e.sessionId),
    );
    return foreign ? { store, entries: [], owned: false } : { store, entries, owned: true };
  }
  // IDB is one store for every take, so it is this take's only when its chunks were written by it.
  // Anything else belongs to a newer take and is never offered or cleared here.
  if (
    tr.backend !== "opfs" &&
    !deps.storeHoldsTake(
      entries.map((e) => ({
        index: e.index,
        size: e.chunk.size,
        ...(typeof e.sessionId === "string" ? { sessionId: e.sessionId } : {}),
      })),
      {
        sessionId: take.realSession ? take.sessionId : null,
        latestSessionId,
        mark: tr.mark,
        tagged: tr.tagged === true,
      },
    )
  ) {
    return { store, entries: [], owned: false };
  }
  return { store, entries, owned: true };
};

const MAX_DISCARDED = 10;

// Discard a held take: clear the stores it owns, mark the session discarded so no sweep or retry
// touches it, drop its journals. A store another take now owns is left alone. The list is stale by
// now, so journals are re-read right before clearing.
const RESUME_LOCK_TTL_MS = 10 * 60 * 1000;
const HOST_BUSY_TTL_MS = 90 * 1000;
const SNAPSHOT_RECOVERABLE = new Set([
  "awaiting-confirm",
  "recording",
  "hidden",
  "unload",
  "stopping",
  "finalize-failed",
  "upload-stalled",
  "stale-cleared",
  "crashed",
]);
// A take read off its snapshot: still there, still recoverable, still held (or
// still stuck), with no live host and no journal that was not in the list.
const snapshotStillHeld = async (take, storage) => {
  const now = Date.now();
  const all = (await storage.get(null)) || {};
  if (all.resumeInProgress && now - (all.resumeLockAt || 0) < RESUME_LOCK_TTL_MS) return false;
  if (all.cloudRecorderHostBusy && now - (all.cloudRecorderHostBusy.at || 0) < HOST_BUSY_TTL_MS) return false;
  const session = all[`cloudRecorderSession:${take.sessionId}`];
  if (!session || session.discardedAt) return false;
  const openJournal = Object.entries(all).some(
    ([k, j]) => k.startsWith("uploadJournal-") && j?.sessionId === take.sessionId && j.status !== "completed",
  );
  if (!SNAPSHOT_RECOVERABLE.has(session.status) && !openJournal) return false;
  if (take.kind === "held" && session.holdUntilRecovered !== true) return false;
  const listed = new Set(take.journalKeys || []);
  return !Object.entries(all).some(
    ([k, j]) =>
      k.startsWith("uploadJournal-") &&
      j?.sessionId === take.sessionId &&
      !listed.has(k) &&
      j.status !== "completed" &&
      j.holdUntilRecovered !== true,
  );
};

// An unpaid mic marker listed on its own: still the same marker, still unpaid, no snapshot the held
// list could show, and nothing recording or starting that would write the shared audio store.
const micDebtStillHeld = async (take, storage) => {
  const all = (await storage.get(null)) || {};
  const now = Date.now();
  if (all.recording || all.pendingRecording) return false;
  if (all.resumeInProgress && now - (all.resumeLockAt || 0) < RESUME_LOCK_TTL_MS) return false;
  if (all.cloudRecorderHostBusy && now - (all.cloudRecorderHostBusy.at || 0) < HOST_BUSY_TTL_MS) return false;
  const m = markerMap(all.pendingMicRecovery)[take.markerKey];
  if (!m || (m.backend || "idb") !== "idb") return false;
  if ((m.sessionId || null) !== take.micSessionId || (m.at || 0) !== take.markerAt) return false;
  // A snapshot that now exists and is listable carries the take itself.
  const snap = m.sessionId
    ? Object.entries(all).find(
        ([k, v]) =>
          k.startsWith("cloudRecorderSession:") &&
          (v?.opfsSessionId === m.sessionId || v?.id === m.sessionId),
      )?.[1]
    : null;
  if (snap && !snap.discardedAt) {
    const open = Object.entries(all).some(
      ([k, j]) => k.startsWith("uploadJournal-") && j?.sessionId === snap.id && j.status !== "completed",
    );
    if (SNAPSHOT_RECOVERABLE.has(snap.status) || open) return false;
  }
  return true;
};

const markerMap = (v) => {
  if (!v || typeof v !== "object") return {};
  if (v.sceneId && !v[v.sceneId]) return { [v.sceneId]: v };
  return { ...v };
};

const discardMicDebt = async (take, deps) => {
  const { storage } = deps;
  const { recorderSession } = await storage.get(["recorderSession"]);
  const latestSessionId = recorderSession?.id || null;
  for (const tr of take.tracks) {
    try {
      const { store, owned } = await readTrack(take, tr, deps, latestSessionId);
      if (owned) await store.clear();
    } catch (err) {
      console.error("[HeldTakes] discard failed", tr.track, err);
      return { ok: false };
    }
  }
  // Re-read: a scan may have paid other markers while the store cleared.
  const map = markerMap((await storage.get(["pendingMicRecovery"])).pendingMicRecovery);
  delete map[take.markerKey];
  if (Object.keys(map).length) await storage.set({ pendingMicRecovery: map });
  else await storage.remove(["pendingMicRecovery"]);
  return { ok: true };
};

const stillHeld = async (take, storage) => {
  if (take.kind === "mic-debt") return micDebtStillHeld(take, storage);
  if (take.fromSnapshot) return snapshotStillHeld(take, storage);
  const keys = [
    ...new Set([...(take.journalKeys || []), ...take.tracks.map((t) => t.journalKey)]),
  ];
  const now = Date.now();
  const got = await storage.get([
    ...keys,
    "resumeInProgress",
    "resumeLockAt",
    "cloudRecorderHostBusy",
  ]);
  if (got.resumeInProgress && now - (got.resumeLockAt || 0) < RESUME_LOCK_TTL_MS) return false;
  if (got.cloudRecorderHostBusy && now - (got.cloudRecorderHostBusy.at || 0) < HOST_BUSY_TTL_MS) return false;
  return keys.every((k) => {
    const j = got[k];
    return j && j.holdUntilRecovered === true && j.status !== "completed";
  });
};

// The user threw the take away, so its unpaid mic marker goes too: left behind
// it would hold every later Start back for bytes that no longer exist.
const clearMicMarkers = async (take, storage) => {
  const ids = new Set([take.sessionId, ...take.tracks.map((t) => t.opfsSessionId)].filter(Boolean));
  const got = await storage.get(["pendingMicRecovery"]);
  const v = got.pendingMicRecovery;
  if (!v || typeof v !== "object") return;
  const map = v.sceneId && !v[v.sceneId] ? { [v.sceneId]: v } : { ...v };
  let changed = false;
  for (const [k, m] of Object.entries(map)) {
    if (m && ids.has(m.sessionId)) {
      delete map[k];
      changed = true;
    }
  }
  if (!changed) return;
  if (Object.keys(map).length) await storage.set({ pendingMicRecovery: map });
  else await storage.remove(["pendingMicRecovery"]);
};

export const discardHeldTake = async (take, deps) => {
  const { storage } = deps;
  if (!(await stillHeld(take, storage))) return { ok: false, stale: true };
  if (take.kind === "mic-debt") return discardMicDebt(take, deps);
  const { recorderSession } = await storage.get(["recorderSession"]);
  const latestSessionId = recorderSession?.id || null;
  // Before any bytes go: a clear cut short still reads as the user's discard,
  // so settle finishes it instead of holding what is left.
  if (take.realSession) {
    const snapKey = `cloudRecorderSession:${take.sessionId}`;
    const snapshot = (await storage.get([snapKey]))[snapKey];
    if (snapshot) await storage.set({ [snapKey]: { ...snapshot, discardedAt: Date.now() } });
  }
  let ok = true;
  for (const tr of take.tracks) {
    try {
      const { store, owned } = await readTrack(take, tr, deps, latestSessionId);
      if (owned) await store.clear();
    } catch (err) {
      ok = false;
      console.error("[HeldTakes] discard failed", tr.track, err);
    }
  }
  if (!ok) return { ok: false };
  if (take.realSession) {
    const id = take.sessionId;
    const { discardedRecordingSessionIds: prev } = await storage.get([
      "discardedRecordingSessionIds",
    ]);
    const list = Array.isArray(prev) ? prev : [];
    await storage.set({
      discardedRecordingSessionIds: [...list.filter((x) => x !== id), id].slice(
        -MAX_DISCARDED,
      ),
    });
    const opfsId = take.tracks.some((t) => t.backend === "opfs")
      ? take.tracks.find((t) => t.opfsSessionId)?.opfsSessionId
      : null;
    if (opfsId) await deps.destroySessionDir(opfsId).catch(() => {});
    await storage.remove([`chunkPurgeMarks:${id}`, `cloudRecorderSession:${id}`]);
    await clearMicMarkers(take, storage);
  }
  // Every journal of the take, not only the larger one per track, so none is
  // left behind to claim a store it no longer has a snapshot for.
  await storage.remove([
    ...new Set(
      [...(take.journalKeys || []), ...take.tracks.map((t) => t.journalKey)].filter(Boolean),
    ),
  ]);
  return { ok: true };
};
