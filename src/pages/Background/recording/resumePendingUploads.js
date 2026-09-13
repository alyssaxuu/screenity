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
export const RESUME_RETRY_ALARM = "resume-pending-uploads-retry";
// `recording` flips false before the host has drained and finalized. Resuming
// inside that window puts two writers on one Bunny video.
const ACTIVE_PIPELINE_STEPS = new Set([
  "recording-starting",
  "uploaders-initializing",
  "uploaders-ready",
  "recording",
  "finalizing",
  "scene-creating",
  "scene-recovering",
]);
// Bounded so a host that died mid-drain can't block resume for good.
const PIPELINE_ACTIVE_TTL_MS = 2 * 60 * 1000;
// CloudRecorder beats every 15s while it holds a take. Past this it is gone.
const HOST_BUSY_TTL_MS = 90 * 1000;
// stale-cleared and crashed are what a toolbar click or a closed recorder tab
// rewrites a crashed take to.
const RECOVERABLE_SESSION_STATUSES = new Set([
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

const pickResumeCandidates = (storage) => {
  const pending = [];
  const abandonedKeys = [];
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
    // Audio resumes too: it's the transcription source, and the track most
    // often left stranded.
    if (!isResumableJournal(value)) continue;
    if (value.status === "completed") continue;
    // status is source of truth; offset>=totalBytes still needs finalize()
    const tries = Math.max(
      attempts[value.mediaId] || 0,
      value.resumeAttempts || 0
    );
    if (tries >= MAX_RESUME_ATTEMPTS) {
      abandonedKeys.push(key);
      continue;
    }
    pending.push(value);
  }
  if (abandonedKeys.length) {
    chrome.storage.local.remove(abandonedKeys).catch(() => {});
  }
  return pending;
};

// Settles from each take's snapshot, so a settle cut short by a closed doc
// finishes on the next pass.
const pickUnsettledSessions = (storage) =>
  Object.entries(storage)
    .filter(
      ([key, session]) =>
        key.startsWith(SESSION_KEY_PREFIX) &&
        session?.id &&
        RECOVERABLE_SESSION_STATUSES.has(session.status)
    )
    .map(([, session]) => session.id);

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

export const tryResumePendingUploads = async ({
  trigger = "unknown",
} = {}) => {
  try {
    const snap = await chrome.storage.local.get([
      "recording",
      "pendingRecording",
      "resumeInProgress",
      "resumeLockAt",
      "recorderPipelineState",
      "cloudRecorderHostBusy",
      "screenityToken",
    ]);
    if (snap.recording || snap.pendingRecording) {
      return { skipped: "recording-active" };
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
    const all = await getAllStorage();
    const candidates = pickResumeCandidates(all);
    const sessions = pickUnsettledSessions(all);
    if (!candidates.length && !sessions.length) {
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
        try {
          chrome.alarms
            ?.create?.(MIC_AWAIT_SCENE_ALARM, {
              delayInMinutes: 5,
              periodInMinutes: 5,
            })
            ?.catch?.(() => {});
        } catch {}
      }
      // A sign-in still settling at browser start fails tus-auth. Nothing else
      // retries that take before the next click.
      if (response?.results?.some((r) => r?.transient)) scheduleRetry(10);
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
