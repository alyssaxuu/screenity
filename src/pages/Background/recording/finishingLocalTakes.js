// A local (free) take that stopped but whose editor has not opened yet is held
// by nothing in the retention registry, which keys on editor tabs. The next
// take starts beside it in the recorder host, so its start-time cleanup must
// skip what this take wrote. One entry per take, kept while its frame lives.
export const FINISHING_LOCAL_TAKE_PREFIX = "finishingLocalTake:";

export const finishingLocalTakeKey = (takeId) =>
  `${FINISHING_LOCAL_TAKE_PREFIX}${takeId}`;

// { live, dead }: entries whose take frame is still in the host, and the keys
// of those whose frame is gone (editor opened and retention took over, or the
// take ended).
export const splitFinishingLocalTakes = (storage = {}, liveTakeIds = []) => {
  const liveIds = new Set(liveTakeIds);
  const live = [];
  const dead = [];
  for (const [key, value] of Object.entries(storage || {})) {
    if (!key.startsWith(FINISHING_LOCAL_TAKE_PREFIX)) continue;
    if (value?.takeId && liveIds.has(value.takeId)) live.push(value);
    else dead.push(key);
  }
  return { live, dead };
};

// Adds the finishing takes to a retention plan. They are never yielded to disk
// pressure or a subscription: nothing else holds their bytes yet.
export const withFinishingTakes = (plan, live, { slotA, slotB }) => {
  if (!live.length) return plan;
  const keepNames = new Set(plan.keepNames || []);
  for (const t of live) {
    if (t.backend === "opfs" && t.fileName) keepNames.add(t.fileName);
  }
  const idb = live
    .filter((t) => t.backend !== "opfs" && t.slot)
    .sort((a, b) => (b.at || 0) - (a.at || 0))[0];
  const retainSlot = idb ? idb.slot : plan.retainSlot;
  const activeSlot = !retainSlot
    ? plan.activeSlot
    : retainSlot === slotA
      ? slotB
      : slotA;
  return { ...plan, keepNames: [...keepNames], retainSlot, activeSlot };
};

// The IDB slot an editor opened by a take owns. The take's own slot, stamped on
// its video-ready, wins: the shared pointer already names the next take's slot
// when that take started before this editor registered.
export const retentionSlotFor = ({ takeSlot, activeChunkSlot }) =>
  takeSlot === "chunks" || takeSlot === "chunks_b"
    ? takeSlot
    : activeChunkSlot || null;

// The backend ref an editor registers with. Read at its own Stop: by the time
// the tab exists the next take's start has nulled the shared ref, or its
// recorder has written its own.
export const retentionBackendRefFor = ({ atStop, now }) =>
  atStop?.backend ? atStop : now || null;
