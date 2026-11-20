// Takes the upload could not place on the server and kept on disk until the
// user exports or discards them. Pure over chrome.storage so the background
// (is there anything to offer?) and the recovery tab (what to show) agree.

const TRACK_ORDER = ["screen", "camera", "audio"];
// Mirrors RECOVERABLE_SESSION_STATUSES in localCopyGate.js: this file has no imports.
const RECOVERABLE_STATUSES = new Set([
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
const HOST_BUSY_TTL_MS = 90 * 1000;
// Mirrors classifyHeldTake in localCopyGate.js: only a take that did not fail,
// whose uploads are all in flight, is progressing while its host beats.
const STUCK_STATUSES = new Set(["finalize-failed", "crashed", "stale-cleared", "unload"]);
const ACTIVE_JOURNAL = new Set(["uploading", "paused", "pending", "starting", "finalizing"]);
const trackOf = (journal) => {
  const t = journal?.trackType || journal?.type || "screen";
  return t === "camera" || t === "audio" ? t : "screen";
};

// Audio is its own container; screen and camera follow the take's snapshot.
export const extensionFor = (track, container) => {
  if (track === "audio") return container === "audio/mp4" ? "m4a" : "webm";
  return container === "video/mp4" ? "mp4" : "webm";
};

export const mimeFor = (track, container) => {
  if (track === "audio") {
    return container === "audio/mp4" ? "audio/mp4" : "audio/webm";
  }
  return container === "video/mp4" ? "video/mp4" : "video/webm";
};

// Mirrors MIC_DEBT_REFUSE_MAX_AGE_MS in micRecovery.js (this file has no imports).
export const MIC_DEBT_MAX_AGE_MS = 60 * 60 * 1000;
// Mirrors MIC_SERVER_FAIL_CAP in micRecovery.js.
export const MIC_SERVER_FAIL_CAP = 8;
// pendingMicRecovery is a map keyed by scene, or the old single-object shape.
export const micMarkerMap = (v) => {
  if (!v || typeof v !== "object") return {};
  if (v.sceneId && !v[v.sceneId]) return { [v.sceneId]: v };
  return v;
};

export const listHeldTakes = (storage = {}) => {
  const discarded = new Set(
    Array.isArray(storage.discardedRecordingSessionIds)
      ? storage.discardedRecordingSessionIds
      : [],
  );
  const bySession = new Map();
  for (const [key, journal] of Object.entries(storage)) {
    if (!key.startsWith("uploadJournal-")) continue;
    if (!journal || typeof journal !== "object") continue;
    if (journal.holdUntilRecovered !== true) continue;
    if (journal.status === "completed") continue;
    // A journal with no session still names a take, so it gets its own entry.
    const sessionId = journal.sessionId || `journal:${journal.mediaId || key}`;
    if (journal.sessionId && discarded.has(journal.sessionId)) continue;
    const session = journal.sessionId
      ? storage[`cloudRecorderSession:${journal.sessionId}`] || null
      : null;
    const track = trackOf(journal);
    const backends = session?.storageBackends || null;
    const container = session?.trackContainers?.[track] || "video/webm";
    const entry = bySession.get(sessionId) || {
      kind: "held",
      sessionId,
      realSession: Boolean(journal.sessionId),
      title: journal.title || null,
      heldAt: 0,
      reasons: new Set(),
      tracks: new Map(),
      journalKeys: [],
    };
    entry.journalKeys.push(key);
    const prior = entry.tracks.get(track);
    // Two journals for one track: the one that carries more bytes is the take.
    if (
      !prior ||
      Number(journal.totalBytes || 0) > Number(prior.journal.totalBytes || 0)
    ) {
      entry.tracks.set(track, {
        track,
        journalKey: key,
        journal,
        backend: backends ? backends[track] || "idb" : "idb",
        opfsSessionId: session?.opfsSessionId || journal.sessionId || null,
        container,
        tagged: session?.chunksTagged === true,
        ext: extensionFor(track, container),
        mime: mimeFor(track, container),
        mark: storage[`chunkPurgeMarks:${journal.sessionId}`]?.[track] || null,
        // First chunk the device could not store locally (disk full or hung);
        // every chunk from there on is missing from the copy.
        gapFrom: Number.isInteger(session?.localCopyGap?.[track])
          ? session.localCopyGap[track]
          : null,
      });
    }
    entry.title = entry.title || journal.title || null;
    entry.heldAt = Math.max(
      entry.heldAt,
      Number(journal.invalidatedAt) || Number(journal.updatedAt) || 0,
    );
    if (journal.invalidatedReason) entry.reasons.add(journal.invalidatedReason);
    bySession.set(sessionId, entry);
  }
  // Takes settle held on the snapshot (no journal to carry the hold), and takes
  // that are stuck with nothing holding them and nothing working on them.
  const beat = storage.cloudRecorderHostBusy;
  const beatFresh = Boolean(beat) && Date.now() - Number(beat.at || 0) < HOST_BUSY_TTL_MS;
  const progressing = (id, session) => {
    if (!beatFresh || beat.sessionId !== id || STUCK_STATUSES.has(session.status)) return false;
    const journals = Object.entries(storage)
      .filter(([k, j]) => k.startsWith("uploadJournal-") && j?.sessionId === id && j.status !== "completed")
      .map(([, j]) => j);
    return (
      journals.length > 0 &&
      journals.every((j) => j.holdUntilRecovered !== true && ACTIVE_JOURNAL.has(j.status))
    );
  };
  const recordingId = storage.recording ? storage.recorderSession?.id || null : null;
  for (const [key, session] of Object.entries(storage)) {
    if (!key.startsWith("cloudRecorderSession:")) continue;
    const id = session?.id;
    if (!id || bySession.has(id) || discarded.has(id)) continue;
    if (session.discardedAt) continue;
    // A settled snapshot with an unfinished journal still holds its store (the
    // recording gate refuses on it), so it is offered like any other.
    const openJournal = Object.entries(storage).some(
      ([k, j]) => k.startsWith("uploadJournal-") && j?.sessionId === id && j.status !== "completed",
    );
    if (!RECOVERABLE_STATUSES.has(session.status) && !openJournal) continue;
    const isHeld = session.holdUntilRecovered === true;
    // A take waiting on Bunny is a normal finish, not something to offer.
    if (session.status === "awaiting-confirm" && !isHeld) continue;
    if (!isHeld && (progressing(id, session) || recordingId === id)) continue;
    const backends = session.storageBackends || { screen: "idb", camera: "idb", audio: "idb" };
    const tracks = TRACK_ORDER.filter((t) => backends[t]).map((track) => {
      const container = session.trackContainers?.[track] || "video/webm";
      return {
        track,
        journalKey: null,
        journal: null,
        backend: backends[track] || "idb",
        opfsSessionId: session.opfsSessionId || id,
        container,
        tagged: session.chunksTagged === true,
        ext: extensionFor(track, container),
        mime: mimeFor(track, container),
        mark: storage[`chunkPurgeMarks:${id}`]?.[track] || null,
        gapFrom: Number.isInteger(session.localCopyGap?.[track])
          ? session.localCopyGap[track]
          : null,
      };
    });
    // Receipts and in-flight journals ride along so a discard removes them.
    const journalKeys = Object.entries(storage)
      .filter(([k, j]) => k.startsWith("uploadJournal-") && j?.sessionId === id)
      .map(([k]) => k);
    bySession.set(id, {
      kind: isHeld ? "held" : "retrying",
      fromSnapshot: true,
      sessionId: id,
      realSession: true,
      title: null,
      heldAt: Number(session.heldAt) || Number(session.updatedAt) || 0,
      reasons: new Set(isHeld && session.heldReason ? [session.heldReason] : []),
      tracks: new Map(tracks.map((t) => [t.track, t])),
      journalKeys,
    });
  }
  // An old unpaid IDB mic marker no snapshot above can show has nothing else
  // to carry it, and Start refuses on it. It gets its own entry so the user
  // has Save (if bytes exist) and Discard. Mirrors classifyIdbMicDebt.
  const markerMap = micMarkerMap(storage.pendingMicRecovery);
  const covered = new Set();
  for (const e of bySession.values()) {
    covered.add(e.sessionId);
    for (const t of e.tracks.values()) if (t.opfsSessionId) covered.add(t.opfsSessionId);
  }
  const now = Date.now();
  for (const [markerKey, m] of Object.entries(markerMap)) {
    if (!m || typeof m !== "object" || (m.backend || "idb") !== "idb") continue;
    // Suspended (server failed the upload too many times) counts as old.
    if ((m.serverFails || 0) < MIC_SERVER_FAIL_CAP && now - (m.at || 0) < MIC_DEBT_MAX_AGE_MS) continue;
    if (m.sessionId && covered.has(m.sessionId)) continue;
    const snap = m.sessionId
      ? Object.entries(storage).find(
          ([k, v]) =>
            k.startsWith("cloudRecorderSession:") &&
            (v?.opfsSessionId === m.sessionId || v?.id === m.sessionId),
        )?.[1]
      : null;
    if (snap && !snap.discardedAt) {
      const open = Object.entries(storage).some(
        ([k, j]) => k.startsWith("uploadJournal-") && j?.sessionId === snap.id && j.status !== "completed",
      );
      // The classifier puts this one on hold, so the snapshot pass lists it.
      if (RECOVERABLE_STATUSES.has(snap.status) || open) continue;
    }
    const id = `mic-debt:${markerKey}`;
    const container = m.mimeType === "audio/mp4" ? "audio/mp4" : "audio/webm";
    bySession.set(id, {
      kind: "mic-debt",
      sessionId: id,
      realSession: false,
      markerKey,
      markerAt: m.at || 0,
      micSessionId: m.sessionId || null,
      micOwnTags: [
        ...new Set(
          [
            m.sessionId,
            m.chunkTagId,
            ...Object.entries(storage)
              .filter(
                ([k, v]) =>
                  k.startsWith("cloudRecorderSession:") && m.sessionId && v?.opfsSessionId === m.sessionId,
              )
              .map(([, v]) => v.id),
          ].filter(Boolean),
        ),
      ],
      title: null,
      heldAt: Number(m.at) || 0,
      reasons: new Set(),
      tracks: new Map([
        [
          "audio",
          {
            track: "audio",
            journalKey: null,
            journal: null,
            backend: "idb",
            opfsSessionId: m.sessionId || null,
            container,
            tagged: false,
            ext: extensionFor("audio", container),
            mime: mimeFor("audio", container),
            mark: null,
            gapFrom: null,
          },
        ],
      ]),
      journalKeys: [],
    });
  }
  return [...bySession.values()]
    .map((e) => ({
      ...e,
      reasons: [...e.reasons],
      tracks: TRACK_ORDER.map((t) => e.tracks.get(t)).filter(Boolean),
    }))
    .sort((a, b) => b.heldAt - a.heldAt);
};
