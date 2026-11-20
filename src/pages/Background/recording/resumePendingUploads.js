const JOURNAL_KEY_PREFIX = "uploadJournal-";
const SESSION_KEY_PREFIX = "cloudRecorderSession:";
// The uploader rewrites the whole journal on every persist, so a counter kept
// inside it resets on each attempt and the cap never trips.
const ATTEMPTS_KEY = "uploadResumeAttempts";
const MAX_RESUME_ATTEMPTS = 5;
const RESUME_LOCK_TTL_MS = 10 * 60 * 1000;
// Same name as MIC_AWAIT_SCENE_ALARM in micRecovery.js, kept literal so this
// module stays dependency-free for its tests.
const MIC_AWAIT_SCENE_ALARM = "mic-recovery-await-scene";
// First look after 30 s, then every 5 min. Armed when resume holds a mic for a
// scene, and when the stop path's inline mic upload failed.
export const armMicAwaitSceneAlarm = async () => {
  try {
    await chrome.alarms?.create?.(MIC_AWAIT_SCENE_ALARM, {
      delayInMinutes: 0.5,
      periodInMinutes: 5,
    });
  } catch {}
};
export const RESUME_RETRY_ALARM = "resume-pending-uploads-retry";
// A take held on a 403 (lapsed plan, other account, proxy) can land once that changes: retried
// on a sign-in change and on this slow timer, as is one held after five non-transient refusals.
// A held 404 stays held: a whole copy in a live project already went up as new media.
export const HELD_RETRY_ALARM = "resume-held-retry";
// A take that finished normally waits for Bunny to confirm it (awaiting-confirm on its snapshot).
// The alarm is set to the earliest due time and set again every pass while any waits.
export const CONFIRM_ALARM = "confirm-awaiting-takes";
// Past this a waiting take is held with a plain write, so a signed-out or offline user sees it
// (with Discard) rather than a silently full disk. Mirrors AWAITING_MAX_AGE_MS in
// confirmTrack.js, kept literal so this module has no imports.
const AWAITING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Short wait before the alarm may fire, so one set for an already-due take does not spin.
const CONFIRM_ALARM_MIN_LEAD_MS = 30 * 1000;
// A skipped pass (signed out, recording, host busy) asked nothing, so the same due step
// would fire every 30 s for up to a day. It backs off.
const CONFIRM_ALARM_SKIP_LEAD_MS = 5 * 60 * 1000;
const HELD_RETRY_REASONS = new Set(["server-403", "resume-attempts-exhausted"]);
const HELD_RETRY_INTERVAL_MS = 6 * 60 * 60 * 1000;
// The periodic alarm keeps its 6 h schedule while a retry stamps its time at the end,
// so the next tick lands a little short.
const HELD_RETRY_SLACK_MS = 30 * 60 * 1000;
// A week of timed retries. A new sign-in still retries past it.
const HELD_RETRY_MAX = 28;
// A toolbar click stops re-checking a take held unconfirmed after this long;
// startup, sign-in and the slow timer keep looking.
const UNCONFIRMED_CLICK_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// `recording` flips false before the host has drained and finalized. Resuming
// inside that window puts two writers on one Bunny video.
export const ACTIVE_PIPELINE_STEPS = new Set([
  "recording-starting",
  "uploaders-initializing",
  "uploaders-ready",
  "recording",
  "finalizing",
  "scene-creating",
  "scene-recovering",
]);
// Bounded so a host that died mid-drain can't block resume for good.
export const PIPELINE_ACTIVE_TTL_MS = 2 * 60 * 1000;
// CloudRecorder beats every 15s while it holds a take. Past this it is gone.
export const HOST_BUSY_TTL_MS = 90 * 1000;
// No recorder document and no sign of life for this long means the host died.
// The server reaps uploads with no completion after 6h, so waiting for a click loses the take.
const DEAD_HOST_QUIET_MS = 5 * 60 * 1000;
// stale-cleared and crashed are what a toolbar click or a closed recorder tab
// rewrites a crashed take to.
const RECOVERABLE_SESSION_STATUSES = new Set([
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

const getAllStorage = () =>
  new Promise((resolve) => {
    try {
      chrome.storage.local.get(null, (all) => resolve(all || {}));
    } catch {
      resolve({});
    }
  });

// resumeOneJournal dereferences these without a fallback, so a journal missing
// any of them can't be resumed safely.
const isResumableJournal = (journal) => {
  if (!journal.mediaId || !journal.projectId || !journal.videoId) return false;
  const track = journal.trackType || journal.type;
  return track === "screen" || track === "camera" || track === "audio";
};

// Tells sign-ins apart without keeping the token. FNV-1a.
export const authFingerprint = (token) => {
  if (!token) return null;
  let h = 0x811c9dc5;
  const str = String(token);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

// A held 403 the current sign-in or the timer says to retry. The copy handed to resume
// continues the take's own upload; storage keeps the tombstone until that upload rewrites it.
const retryHeld = (value, storage, now) => {
  if (!HELD_RETRY_REASONS.has(value.invalidatedReason)) return null;
  const auth = authFingerprint(storage.screenityToken);
  if (!auth) return null;
  const retries = Number(value.holdRetries) || 0;
  const signInChanged = Boolean(value.holdAuth) && value.holdAuth !== auth;
  const due =
    retries < HELD_RETRY_MAX &&
    now - (Number(value.holdRetryAt) || 0) >=
      HELD_RETRY_INTERVAL_MS - HELD_RETRY_SLACK_MS;
  const stamp = { holdAuth: auth, holdRetryAt: now };
  // Never stamped (the pass that held it died): stamp, wait for a change.
  if (!value.holdAuth) return { update: { ...value, ...stamp }, journal: null };
  if (!signInChanged && !due) return null;
  const update = { ...value, ...stamp, holdRetries: retries + 1 };
  // The copy carries the new count: the upload rewrites the stored journal from it.
  return {
    update,
    journal: {
      ...update,
      status: "error",
      uploadUrl: value.heldUploadUrl || null,
      holdUntilRecovered: false,
    },
  };
};

const pickResumeCandidates = (storage) => {
  const pending = [];
  const abandonedKeys = [];
  const heldUpdates = {};
  // Stamped only once the pass is sure to reach the server, so a skipped
  // pass spends none of the take's timed retries.
  const retryUpdates = {};
  const now = Date.now();
  const attempts = storage[ATTEMPTS_KEY] || {};
  const discarded = new Set(
    Array.isArray(storage.discardedRecordingSessionIds)
      ? storage.discardedRecordingSessionIds
      : []
  );
  for (const [key, value] of Object.entries(storage)) {
    if (!key.startsWith(JOURNAL_KEY_PREFIX)) continue;
    if (!value || typeof value !== "object") continue;
    if (value.sessionId && discarded.has(value.sessionId)) {
      abandonedKeys.push(key);
      continue;
    }
    // A receipt is only evidence for a take that is still recoverable.
    if (value.status === "completed") {
      const snap = value.sessionId
        ? storage[`${SESSION_KEY_PREFIX}${value.sessionId}`]
        : null;
      if (!snap || !RECOVERABLE_SESSION_STATUSES.has(snap.status)) {
        abandonedKeys.push(key);
      }
      continue;
    }
    // Audio resumes too: it's the transcription source, and the track most
    // often left stranded.
    if (!isResumableJournal(value)) continue;
    if (value.status === "completed") continue;
    // Held until the user recovers or discards the take, and the tombstone is
    // what keeps the local copy. Only a 403 has anything more to try.
    if (value.holdUntilRecovered === true) {
      const retry = retryHeld(value, storage, now);
      if (retry?.journal) {
        retryUpdates[key] = retry.update;
        pending.push(retry.journal);
      } else if (retry) {
        heldUpdates[key] = retry.update;
      }
      continue;
    }
    // status is source of truth; offset>=totalBytes still needs finalize()
    const tries = Math.max(
      attempts[value.mediaId] || 0,
      value.resumeAttempts || 0
    );
    if (tries >= MAX_RESUME_ATTEMPTS) {
      // Removing the journal would let settle delete bytes that never landed.
      // The slow timer retries it in the same upload, starting now.
      const auth = authFingerprint(storage.screenityToken);
      heldUpdates[key] = {
        ...value,
        status: "invalidated",
        uploadUrl: null,
        heldUploadUrl: value.uploadUrl || value.heldUploadUrl || null,
        invalidatedAt:
          value.status === "invalidated" && Number(value.invalidatedAt) > 0
            ? value.invalidatedAt
            : Date.now(),
        invalidatedReason: "resume-attempts-exhausted",
        holdUntilRecovered: true,
        ...(auth ? { holdAuth: auth, holdRetryAt: now } : {}),
      };
      continue;
    }
    pending.push(value);
  }
  return { pending, abandonedKeys, heldUpdates, retryUpdates };
};

// Creating an alarm under the same name restarts its delay, so a pass that
// finds one already set leaves it alone.
const armHeldRetryAlarm = async () => {
  try {
    if (chrome.alarms?.get && (await chrome.alarms.get(HELD_RETRY_ALARM))) return;
    await chrome.alarms?.create?.(HELD_RETRY_ALARM, {
      delayInMinutes: HELD_RETRY_INTERVAL_MS / 60000,
      periodInMinutes: HELD_RETRY_INTERVAL_MS / 60000,
    });
  } catch {}
};

// A held take a timed retry can still reach: a retryable reason, retries left,
// not discarded, and a sign-in to retry with.
const hasTimedRetryWaiting = (storage, { abandonedKeys = [], heldUpdates = {} } = {}) => {
  if (!storage.screenityToken) return false;
  const gone = new Set(abandonedKeys);
  // A take held unconfirmed is looked at again on the slow timer, for as long
  // as the timed retries of a journal last.
  const now = Date.now();
  const unconfirmedWaiting = Object.entries(storage).some(
    ([k, v]) =>
      k.startsWith(SESSION_KEY_PREFIX) &&
      v?.holdUntilRecovered === true &&
      v.heldReason === "unconfirmed" &&
      RECOVERABLE_SESSION_STATUSES.has(v.status) &&
      !(Number(v.discardedAt) > 0) &&
      now - (Number(v.heldAt) || now) < HELD_RETRY_MAX * HELD_RETRY_INTERVAL_MS
  );
  if (unconfirmedWaiting) return true;
  return Object.entries(storage).some(([k, v]) => {
    if (!k.startsWith(JOURNAL_KEY_PREFIX) || gone.has(k)) return false;
    const j = heldUpdates[k] || v;
    return (
      j?.holdUntilRecovered === true &&
      HELD_RETRY_REASONS.has(j.invalidatedReason) &&
      (Number(j.holdRetries) || 0) < HELD_RETRY_MAX
    );
  });
};

const applyCandidateCleanup = async ({ abandonedKeys, heldUpdates }) => {
  if (abandonedKeys.length) {
    await chrome.storage.local.remove(abandonedKeys).catch(() => {});
  }
  if (Object.keys(heldUpdates).length) {
    await chrome.storage.local.set(heldUpdates).catch(() => {});
  }
};

// Settles from each take's snapshot, so a settle cut short by a closed doc
// finishes on the next pass. A session with a held journal is skipped: settle leaves it alone
// while any journal is held, so sending it would open an offscreen document on every click.
const pickUnsettledSessions = (
  storage,
  { fromConfirmAlarm = false, fromClick = false } = {},
) => {
  const now = Date.now();
  const discarded = new Set(
    Array.isArray(storage.discardedRecordingSessionIds)
      ? storage.discardedRecordingSessionIds
      : [],
  );
  // A take waiting on Bunny is looked at only when its step is due. A hold is the user's, but
  // an unconfirmed one is revisited, since Bunny finishing clears it. The confirm alarm leaves those to the others.
  const wanted = (session) => {
    if (!RECOVERABLE_SESSION_STATUSES.has(session.status)) return false;
    if (session.holdUntilRecovered === true) {
      if (session.heldReason !== "unconfirmed" || fromConfirmAlarm) return false;
      // Every click would open the resume page and call Bunny again, and a
      // Start right after it waits for that page to close.
      const heldAt = Number(session.heldAt) || 0;
      return !(fromClick && heldAt > 0 && now - heldAt > UNCONFIRMED_CLICK_MAX_AGE_MS);
    }
    if (session.status !== "awaiting-confirm") return true;
    if (discarded.has(session.id) || Number(session.discardedAt) > 0) return true;
    return Number(session.nextConfirmAt || 0) <= now;
  };
  const heldSessions = new Set(
    Object.entries(storage)
      .filter(
        ([key, j]) =>
          key.startsWith(JOURNAL_KEY_PREFIX) &&
          j?.holdUntilRecovered === true &&
          j.status !== "completed" &&
          j.sessionId,
      )
      .map(([, j]) => j.sessionId),
  );
  return Object.entries(storage)
    .filter(
      ([key, session]) =>
        key.startsWith(SESSION_KEY_PREFIX) &&
        session?.id &&
        !heldSessions.has(session.id) &&
        wanted(session),
    )
    .map(([, session]) => session.id);
};

// Take frames in the recorder host document (offscreenrecorder.html?take=...).
const takeFramesAlive = async () => {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    return (contexts || []).some(
      (c) => c.frameId && /[?&]take=/.test(String(c.documentUrl || "")),
    );
  } catch {
    return false;
  }
};

// A resume doc never acks a shutdown, so leaving it open makes the next start
// wait out the whole flush timeout.
const closeResumeDoc = async () => {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    if (contexts?.[0]?.documentUrl?.includes("resume=1")) {
      await chrome.offscreen.closeDocument();
    }
  } catch {}
};

// Startup and install fire once. A skipped pass retries on its own, since the
// next click is usually a new recording.
const scheduleRetry = (delayInMinutes = 2) => {
  try {
    chrome.alarms?.create?.(RESUME_RETRY_ALARM, { delayInMinutes })?.catch?.(() => {});
  } catch {}
};

// A take this pass held on a 403 remembers which sign-in was refused, so a
// new one retries it, and the slow timer is set while any such take waits.
const stampHeldRetries = async (results, token) => {
  try {
    const auth = authFingerprint(token);
    const keys = (results || [])
      .filter((r) => r?.held && HELD_RETRY_REASONS.has(r.error) && r.mediaId)
      .map((r) => `${JOURNAL_KEY_PREFIX}${r.mediaId}`);
    const stored = keys.length ? await chrome.storage.local.get(keys) : {};
    const updates = {};
    for (const key of keys) {
      const j = stored[key];
      if (j?.holdUntilRecovered !== true) continue;
      updates[key] = { ...j, holdAuth: auth, holdRetryAt: Date.now() };
    }
    if (Object.keys(updates).length) await chrome.storage.local.set(updates);
    const all = await getAllStorage();
    const waiting = hasTimedRetryWaiting({ ...all, screenityToken: token });
    if (waiting) {
      await armHeldRetryAlarm();
    } else {
      chrome.alarms?.clear?.(HELD_RETRY_ALARM)?.catch?.(() => {});
    }
  } catch {}
};

// null: no usable stamp. false: not quiet long enough. true: quiet past the limit.
// Stamps from before this take's click belong to an earlier take, so a start stuck in
// setup can't look like a dead host.
export const judgeHostQuiet = (snap, now = Date.now()) => {
  const takeStart = Number.isFinite(snap.pendingRecordingAt)
    ? snap.pendingRecordingAt
    : 0;
  const stamps = [
    snap.firstChunkAt,
    snap.lastChunkAt,
    snap.recorderPipelineState?.ts,
    snap.cloudRecorderHostBusy?.at,
  ].filter((t) => Number.isFinite(t) && t > 0 && t >= takeStart);
  if (!stamps.length) return null;
  return now - Math.max(...stamps) >= DEAD_HOST_QUIET_MS;
};

// Same keys the stale-reset in onActionButtonClickedListener and the startup sweep
// clear. The icon follows `recording` via lifecycleObserver.
const DEAD_HOST_FLAG_RESET = {
  recording: false,
  pendingRecording: false,
  restarting: false,
  offscreen: false,
  recordingTab: null,
  region: false,
  customRegion: false,
  recordingUiTabId: null,
  tabRecordedID: null,
  paused: false,
  pausedAt: null,
  totalPausedMs: 0,
  recordingStallLevel: 0,
  postStopEditorOpened: false,
  postStopEditorOpening: false,
  recordingToScene: false,
  projectId: null,
  activeSceneId: null,
  multiMode: false,
  multiSceneCount: 0,
  multiProjectId: null,
  multiLastSceneId: null,
};

// null: host alive or unjudgeable, flag stands. false: not quiet long enough. true: dead.
// Only one offscreen document can exist, so resuming beside a live one evicts it.
const recorderHostIsGone = async (snap) => {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
    });
    if (contexts?.length) return null;
    // Custom-region and kill-switch recordings host the recorder in a tab.
    if (snap.recordingTab != null) {
      const tab = await chrome.tabs.get(snap.recordingTab).catch(() => null);
      if (tab) return null;
    }
    return judgeHostQuiet(snap);
  } catch {
    return null;
  }
};

// The earliest time a take waiting on Bunny is due, or null.
const earliestConfirmAt = (storage) => {
  let at = null;
  for (const [key, s] of Object.entries(storage)) {
    if (!key.startsWith(SESSION_KEY_PREFIX) || s?.status !== "awaiting-confirm") continue;
    if (s.holdUntilRecovered === true || Number(s.discardedAt) > 0) continue;
    const t = Number(s.nextConfirmAt);
    if (Number.isFinite(t) && (at === null || t < at)) at = t;
  }
  return at;
};

// Set again after every pass: an alarm lost to an update or a missed message comes back with the
// next click, startup or pass. A due take is asked for shortly, never in the past; a live recording skips the pass.
export const armConfirmAlarm = async ({ minLeadMs = CONFIRM_ALARM_MIN_LEAD_MS } = {}) => {
  try {
    const at = earliestConfirmAt(await getAllStorage());
    if (at === null) {
      if (await chrome.alarms?.get?.(CONFIRM_ALARM)) {
        await chrome.alarms?.clear?.(CONFIRM_ALARM);
      }
      return;
    }
    await chrome.alarms?.create?.(CONFIRM_ALARM, {
      when:
        at <= Date.now() + CONFIRM_ALARM_MIN_LEAD_MS
          ? Date.now() + minLeadMs
          : at,
    });
  } catch {}
};

// A take that has waited this long without Bunny confirming it is held for the
// user, with a plain storage write, since nothing here may need the network.
const holdOverdueAwaiting = async () => {
  const all = await getAllStorage();
  const now = Date.now();
  const updates = {};
  for (const [key, s] of Object.entries(all)) {
    if (!key.startsWith(SESSION_KEY_PREFIX) || s?.status !== "awaiting-confirm") continue;
    if (s.holdUntilRecovered === true) continue;
    const since = Number(s.awaitingSince) || Number(s.finishedAt) || 0;
    if (!(since > 0) || now - since <= AWAITING_MAX_AGE_MS) continue;
    const { confirmChecks, ...rest } = s;
    updates[key] = {
      ...rest,
      holdUntilRecovered: true,
      heldReason: "unconfirmed",
      heldAt: now,
    };
  }
  if (Object.keys(updates).length) await chrome.storage.local.set(updates);
};

export const tryResumePendingUploads = async (opts = {}) => {
  await holdOverdueAwaiting().catch(() => {});
  const result = await runResumePass(opts);
  await armConfirmAlarm(
    result?.skipped ? { minLeadMs: CONFIRM_ALARM_SKIP_LEAD_MS } : undefined
  );
  return result;
};

const runResumePass = async ({
  trigger = "unknown",
} = {}) => {
  try {
    const snap = await chrome.storage.local.get([
      "recording",
      "pendingRecording",
      "pendingRecordingAt",
      "resumeInProgress",
      "resumeLockAt",
      "recorderPipelineState",
      "cloudRecorderHostBusy",
      "firstChunkAt",
      "lastChunkAt",
      "recordingTab",
      "screenityToken",
    ]);
    if (snap.recording || snap.pendingRecording) {
      const hostGone = await recorderHostIsGone(snap);
      if (hostGone === null) {
        // A take parked for the live one has no other trigger.
        scheduleRetry(2);
        return { skipped: "recording-active" };
      }
      if (!hostGone) {
        scheduleRetry(1);
        return { skipped: "recording-active" };
      }
      // Nothing else clears these once the host is gone, so the popup and toolbar
      // would keep showing a recording that no longer exists.
      await chrome.storage.local.set(DEAD_HOST_FLAG_RESET).catch(() => {});
    }
    // Nothing survives a browser start or extension reload, so a leftover step or
    // beat belongs to the host that died.
    const hostsCanBeAlive = !/^on(Startup|Installed)/.test(String(trigger));
    const pipeline = snap.recorderPipelineState;
    if (
      hostsCanBeAlive &&
      pipeline &&
      ACTIVE_PIPELINE_STEPS.has(pipeline.step) &&
      Date.now() - (pipeline.ts || 0) < PIPELINE_ACTIVE_TTL_MS
    ) {
      scheduleRetry();
      return { skipped: `pipeline-active-${pipeline.step}` };
    }
    const hostBusy = snap.cloudRecorderHostBusy;
    if (
      hostsCanBeAlive &&
      hostBusy &&
      Date.now() - (hostBusy.at || 0) < HOST_BUSY_TTL_MS
    ) {
      scheduleRetry();
      return { skipped: "host-busy" };
    }
    // A take still finishing in the host document owns its journal; resuming
    // it beside that take would upload the same bytes twice.
    if (await takeFramesAlive()) {
      scheduleRetry();
      return { skipped: "takes-finishing" };
    }
    const all = await getAllStorage();
    const picked = pickResumeCandidates(all);
    await applyCandidateCleanup(picked);
    const candidates = picked.pending;
    const sessions = pickUnsettledSessions(all, {
      fromConfirmAlarm: trigger === "confirm-alarm",
      fromClick: trigger === "actionClick",
    });
    if (!candidates.length && !sessions.length) {
      // An update can clear the alarm, so a take still waiting on a timed
      // retry gets it back, and one with nothing left to wait for drops it.
      if (hasTimedRetryWaiting(all, picked)) await armHeldRetryAlarm();
      else await chrome.alarms?.clear?.(HELD_RETRY_ALARM)?.catch?.(() => {});
      return { skipped: "nothing-to-recover" };
    }
    // Can't reach the server, so retry later. Signed out waits for the click
    // after signing in.
    if (globalThis.navigator?.onLine === false) {
      scheduleRetry();
      return { skipped: "offline" };
    }
    if (!snap.screenityToken) return { skipped: "signed-out" };
    if (snap.resumeInProgress) {
      const lockAge = Date.now() - (snap.resumeLockAt || 0);
      if (lockAge < RESUME_LOCK_TTL_MS) {
        scheduleRetry();
        return { skipped: "resume-in-progress" };
      }
      console.warn("[ResumeUploads] stale lock detected, clearing");
    }
    if (Object.keys(picked.retryUpdates).length) {
      await chrome.storage.local.set(picked.retryUpdates).catch(() => {});
    }

    console.log(
      "[ResumeUploads] journals:",
      candidates.length,
      "unsettled sessions:",
      sessions.length,
      "trigger:",
      trigger,
    );

    await chrome.storage.local.set({
      resumeInProgress: true,
      resumeLockAt: Date.now(),
    });

    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
      });
      if (!contexts || contexts.length === 0) {
        await chrome.offscreen.createDocument({
          url: "offscreenrecorder.html?resume=1",
          reasons: ["BLOBS", "USER_MEDIA"],
          justification: "Resuming incomplete TUS uploads",
        });
        await new Promise((r) => setTimeout(r, 300));
      }

      const response = await chrome.runtime
        .sendMessage({
          type: "resume-pending-uploads",
          journals: candidates,
          sessions,
          trigger,
        })
        .catch((err) => ({
          ok: false,
          error: err?.message || String(err),
        }));

      console.log("[ResumeUploads] offscreen response:", response);
      if (response?.recovered?.some((r) => r?.micHeld)) {
        // The mic waits for a scene that appears minutes after the upload.
        await armMicAwaitSceneAlarm();
      }
      // A sign-in still settling at browser start fails tus-auth. Nothing else
      // retries that take before the next click.
      if (response?.results?.some((r) => r?.transient) || response?.retry) {
        scheduleRetry(10);
      }
      await stampHeldRetries(response?.results, snap.screenityToken);
      await closeResumeDoc();
      return response || { ok: false };
    } finally {
      await chrome.storage.local.set({
        resumeInProgress: false,
        resumeLockAt: null,
      });
    }
  } catch (err) {
    console.error("[ResumeUploads] unexpected error:", err);
    await chrome.storage.local
      .set({ resumeInProgress: false, resumeLockAt: null })
      .catch(() => {});
    return { ok: false, error: err?.message || String(err) };
  }
};
