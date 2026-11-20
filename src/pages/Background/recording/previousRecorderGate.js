// A new take starts in its own frame beside a finishing one, so the start waits only for the previous
// take to release its capture (Stop ended its tracks). Two captures from one extension never run at
// once; uploads, scene and mic finishing do not hold the start.
export const HOLD_TIMEOUT_MS = 20000;
export const HOLD_POLL_MS = 250;
// Past this the session isn't being written any more: a leftover "stopping"
// is a wedged recorder, not a capture.
export const STALE_SESSION_MS = 5 * 60 * 1000;
const STOPPING_STATUSES = new Set(["stopping", "finishing"]);

const isFresh = (session, now) => {
  const at = Number(session?.updatedAt);
  return !(Number.isFinite(at) && at > 0 && now - at > STALE_SESSION_MS);
};

// session: the cloud recorder's, released once it stamps captureReleasedAt. freeSession: the local
// recorder's, which stops its tracks right after writing "completed".
export const isPreviousCaptureLive = ({
  hasRecorder,
  session,
  freeSession = null,
  now = Date.now(),
}) => {
  if (!hasRecorder) return false;
  const cloudLive =
    Boolean(session) &&
    STOPPING_STATUSES.has(session.status) &&
    !(Number(session.captureReleasedAt) > 0) &&
    isFresh(session, now);
  const freeLive =
    Boolean(freeSession) &&
    freeSession.status === "stopping" &&
    isFresh(freeSession, now);
  return cloudLive || freeLive;
};

// Resolves { held, waitedMs, refused }. `onHold` fires once when the wait begins.
export const holdForPreviousRecorder = async ({
  read,
  onHold = () => {},
  timeoutMs = HOLD_TIMEOUT_MS,
  pollMs = HOLD_POLL_MS,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = Date.now,
}) => {
  const startedAt = now();
  if (!isPreviousCaptureLive({ ...(await read()), now: now() })) {
    return { held: false, waitedMs: 0, refused: false };
  }
  onHold();
  while (now() - startedAt < timeoutMs) {
    await sleep(pollMs);
    if (!isPreviousCaptureLive({ ...(await read()), now: now() })) {
      return { held: true, waitedMs: now() - startedAt, refused: false };
    }
  }
  return { held: true, waitedMs: now() - startedAt, refused: true };
};

// A capture still live past the hold is a wedged take, not a slow one. The start goes ahead as it did
// before side-by-side takes. The last-started take, if a host frame, is flushed through its finalize
// (bytes stay on disk for resume) and removed; earlier takes released their capture before it started.
// Resolves the take flushed, or null.
export const releaseWedgedTake = async ({ readContexts, readActiveTakeId, flush }) => {
  const [{ frames }, activeTakeId] = await Promise.all([
    readContexts(),
    readActiveTakeId(),
  ]);
  const wedged = (frames || []).find((f) => f.takeId === activeTakeId);
  if (!wedged) return null;
  await flush({
    reason: "start-wedged-previous",
    shouldFinalize: true,
    takeId: wedged.takeId,
    timeoutMs: 5000,
  });
  return wedged.takeId;
};

// A Pro take writes projectId for itself and only its finalize clears it, so a take started meanwhile
// would become that project's next scene. External callers always pair projectId with recordingToScene
// and multi mode keeps one project on purpose; any other projectId at a start is left over. Run after
// the gate: by then the previous take has its own copy.
export const leftoverProjectReset = ({ projectId, recordingToScene, multiMode } = {}) =>
  projectId && !recordingToScene && !multiMode ? { projectId: null } : null;

// Any recorder still alive: a take frame or recorder document offscreen, or a
// recorder tab (tab host, custom region).
export const hasRecorderContext = (contexts = []) =>
  (contexts || []).some((c) => {
    const url = typeof c?.documentUrl === "string" ? c.documentUrl : "";
    if (c.contextType === "OFFSCREEN_DOCUMENT") {
      return (
        url.includes("offscreenrecorder.html") &&
        !/[?&](host|resume)=1/.test(url)
      );
    }
    return c.contextType === "TAB" && /\/(cloudrecorder|recorder|region)\.html/.test(url);
  });

// A take stops writing the shared pointer once the next Start click claims a new attempt, so its
// captureReleasedAt lands only in its own cloudRecorderSession:<id> key (written on every persist).
export const pickNewerSessionState = (pointer, own) => {
  if (!pointer) return null;
  if (!own || own.id !== pointer.id) return pointer;
  const ownAt = Number(own.updatedAt) || 0;
  const pointerAt = Number(pointer.updatedAt) || 0;
  return ownAt >= pointerAt ? own : pointer;
};

const withOwnSessionState = async (pointer) => {
  if (!pointer?.id) return pointer;
  const key = `cloudRecorderSession:${pointer.id}`;
  try {
    const { [key]: own } = await chrome.storage.local.get([key]);
    return pickNewerSessionState(pointer, own || null);
  } catch {
    return pointer;
  }
};

export const readPreviousRecorderState = async () => {
  let hasRecorder = false;
  try {
    hasRecorder = hasRecorderContext(await chrome.runtime.getContexts({}));
  } catch {}
  const { recorderSession, freeRecorderSession } =
    await chrome.storage.local.get(["recorderSession", "freeRecorderSession"]);
  return {
    hasRecorder,
    session: await withOwnSessionState(recorderSession || null),
    freeSession: freeRecorderSession || null,
  };
};
