// A take on the shared IDB stores that is waiting on Bunny (or held unconfirmed) cannot own them
// against the next take, which clears them at start. This asks Bunny once, within a short budget:
// confirmed is finished, rejected or short is held (start refused, take listed), anything else is
// released with a log line, since the server acknowledged every byte.
// No imports: the recorder and unit tests load it as is, so the network-free checks (localCheck) are a parameter.

const TRACKS = ["screen", "camera", "audio"];
const PREFIX = "cloudRecorderSession:";

const trackOfJournal = (j) => {
  const t = j.trackType || j.type || "screen";
  return t === "camera" || t === "audio" ? t : "screen";
};

const receiptsOf = (all, sessionId, track) =>
  Object.entries(all).filter(([k, j]) => {
    if (!k.startsWith("uploadJournal-") || j?.sessionId !== sessionId) return false;
    if (j.status !== "completed") return false;
    return trackOfJournal(j) === track;
  });

// The release pass threw, so nothing is known about the waiting takes. Each is held, which makes
// heldIdbTracks count it and keeps the next start from clearing its stores. Returns the ids held;
// a take whose write failed is left out, and the caller refuses the start regardless.
export const holdAwaitingTakes = async ({ storage, now = Date.now }) => {
  const held = [];
  const all = (await storage.get(null)) || {};
  const discarded = new Set(
    Array.isArray(all.discardedRecordingSessionIds) ? all.discardedRecordingSessionIds : []
  );
  for (const [key, snap] of Object.entries(all)) {
    if (!key.startsWith(PREFIX) || snap?.status !== "awaiting-confirm") continue;
    if (!snap.id || discarded.has(snap.id) || Number(snap.discardedAt) > 0) continue;
    if (snap.holdUntilRecovered === true) continue;
    // Only a take with an IDB track can lose its store to the next start.
    if (!TRACKS.some((t) => (snap.storageBackends ? snap.storageBackends[t] || "idb" : "idb") === "idb")) continue;
    const { confirmChecks, ...rest } = snap;
    try {
      await storage.set({
        [key]: { ...rest, holdUntilRecovered: true, heldReason: "store-unreadable", heldAt: now() },
      });
      held.push(snap.id);
    } catch {}
  }
  return held;
};

export const releaseSupersededTakes = async ({
  storage,
  confirm,
  localCheck,
  readOwnEnd,
  tracks,
  emit = () => {},
  budgetMs = 2000,
  now = Date.now,
}) => {
  const outcome = { confirmed: [], released: [], held: [] };
  const all = (await storage.get(null)) || {};
  const discarded = new Set(
    Array.isArray(all.discardedRecordingSessionIds) ? all.discardedRecordingSessionIds : []
  );
  const deadline = now() + budgetMs;
  for (const [key, snap] of Object.entries(all)) {
    if (!key.startsWith(PREFIX) || snap?.status !== "awaiting-confirm") continue;
    const id = snap.id;
    if (!id || discarded.has(id) || Number(snap.discardedAt) > 0) continue;
    if (snap.holdUntilRecovered === true && snap.heldReason !== "unconfirmed") continue;
    const owned = [];
    // Every IDB track of the old take, not only the ones the new take writes:
    // the take is marked finished as a whole, so each track needs its proof.
    const backendOf = (track) =>
      snap.storageBackends ? snap.storageBackends[track] || "idb" : "idb";
    const receiptListFor = (track) =>
      receiptsOf(all, id, track)
        .map(([k, j]) => ({
          ...j,
          mediaId: j.mediaId || k.slice("uploadJournal-".length),
        }))
        .sort((a, b) => Number(b.finalizedBytes || 0) - Number(a.finalizedBytes || 0));
    const receiptFor = (track) => receiptListFor(track)[0];
    for (const track of TRACKS) {
      if (backendOf(track) !== "idb") continue;
      const ownEnd = await readOwnEnd(id, track, snap, all[`chunkPurgeMarks:${id}`]?.[track] || null);
      if (ownEnd == null) continue;
      owned.push({ track, ownEnd, receipt: receiptFor(track) });
      // The scene may name a smaller receipt than the largest, and its bytes are on disk, so each is
      // judged. Only the largest answers for the local length; the others are asked about Bunny alone.
      for (const extra of receiptListFor(track).slice(1)) {
        owned.push({
          track,
          ownEnd: Math.min(ownEnd, Number(extra.finalizedBytes) || 0),
          receipt: extra,
        });
      }
    }
    if (!owned.length) continue;
    // A take is finished as a whole, so a track on another backend that recorded anything (a journal
    // of any status, or an uploader in the snapshot) needs its receipt too, judged against its own
    // local end. A folder that cannot be read holds the take.
    for (const track of TRACKS) {
      if (backendOf(track) === "idb") continue;
      const recorded =
        Boolean(snap.tracks?.[track]?.uploader) ||
        Object.entries(all).some(
          ([k, j]) =>
            k.startsWith("uploadJournal-") &&
            j?.sessionId === id &&
            trackOfJournal(j) === track
        );
      if (!recorded) continue;
      let ownEnd = Infinity;
      try {
        ownEnd = await readOwnEnd(id, track, snap, all[`chunkPurgeMarks:${id}`]?.[track] || null);
      } catch {}
      owned.push({ track, ownEnd: ownEnd == null ? 0 : ownEnd, receipt: receiptFor(track), foreign: true });
    }
    // A store that could not be read, or holds a foreign chunk among this
    // take's, is not proof of anything: the take is held, never released.
    const unproven = owned.some((o) => o.ownEnd === Infinity);

    // A mic with no uploader of its own is not judged by a receipt: muxed into
    // the screen or camera file it follows that track, and a separated one is
    // safe only once it attached.
    let hold = null;
    for (const o of [...owned]) {
      if (o.foreign || o.track !== "audio" || snap.tracks?.audio?.hasUploader === true || o.receipt) continue;
      if (snap.separatedAudio === true) {
        if (snap.micAttached !== true) hold = "mic-unattached";
      } else if (owned.length === 1) {
        hold = "no-journal";
      }
      owned.splice(owned.indexOf(o), 1);
    }

    const verdicts = [];
    for (const o of unproven ? [] : owned) {
      const left = deadline - now();
      // Only the Bunny question is budgeted. The checks against the local
      // copy cost nothing, so a spent budget never skips them.
      const local = o.foreign && !o.receipt
        ? { state: "no-video" }
        : localCheck({ receipt: o.receipt, ownEnd: o.ownEnd });
      if (local) {
        verdicts.push(local);
        continue;
      }
      if (left <= 0) {
        verdicts.push({ state: "budget" });
        continue;
      }
      let timer;
      const v = await Promise.race([
        confirm({ receipt: o.receipt, ownEnd: o.ownEnd }).catch(() => ({ state: "transient" })),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve({ state: "budget" }), left);
        }),
      ]);
      clearTimeout(timer);
      verdicts.push(v);
    }
    const has = (s) => verdicts.some((v) => v.state === s);
    const { confirmChecks, holdUntilRecovered, heldReason, heldAt, ...rest } = snap;
    hold = hold || (unproven
      ? "store-unreadable"
      : has("short")
      ? "finalized-short"
      : has("rejected")
      ? "server-rejected"
      : has("no-video")
      ? "no-journal"
      : null);
    if (hold) {
      await storage.set({
        [key]: { ...rest, holdUntilRecovered: true, heldReason: hold, heldAt: now() },
      });
      outcome.held.push({ sessionId: id, reason: hold });
      continue;
    }
    const bunnyStatus = verdicts.map((v) => v.bunnyStatus).find((s) => Number.isFinite(s));
    const mediaId = owned.map((o) => o.receipt?.mediaId).find(Boolean) || null;
    const allConfirmed = verdicts.every((v) => v.state === "confirmed");
    const endedAs = snap.awaitingOutcome === "failed" ? "failed" : "completed";
    const stamp = allConfirmed
      ? { confirmedAt: now() }
      : {
          releasedUnconfirmed: {
            reason: "superseded-idb",
            ...(Number.isFinite(bunnyStatus) ? { bunnyStatus } : {}),
            at: now(),
          },
        };
    await storage.set({ [key]: { ...rest, status: endedAs, ...stamp } });
    const gone = owned.filter((o) => !o.foreign).flatMap((o) => receiptsOf(all, id, o.track).map(([k]) => k));
    await storage.remove([...gone, `chunkPurgeMarks:${id}`]);
    if (allConfirmed) {
      outcome.confirmed.push(id);
      emit("upload_local_confirmed", {
        ...(Number.isFinite(bunnyStatus) ? { bunnyStatus } : {}),
        mediaId,
        confirmMs: Math.max(0, now() - (Number(snap.awaitingSince) || now())),
        checks: Number(snap.confirmChecks) || 0,
        recordingSessionId: id,
      });
    } else {
      outcome.released.push(id);
      emit("upload_local_released_unconfirmed", {
        reason: "superseded-idb",
        mediaId,
        ...(Number.isFinite(bunnyStatus) ? { bunnyStatus } : {}),
        recordingSessionId: id,
      });
    }
  }
  return outcome;
};
