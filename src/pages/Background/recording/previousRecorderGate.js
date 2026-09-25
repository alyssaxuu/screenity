// Chrome allows one offscreen document, so a new take closes the old one,
// cutting off uploads and the scene POST if it is still finalizing. Wait, and
// refuse the new start rather than close it.
export const HOLD_TIMEOUT_MS = 60000;
export const HOLD_POLL_MS = 500;
// Past this the session isn't being written any more: a leftover "stopping"
// is a wedged recorder, not an upload.
export const STALE_SESSION_MS = 5 * 60 * 1000;
const FINALIZING_STATUSES = new Set(["stopping", "finishing"]);

export const isPreviousRecorderFinalizing = ({
  hasOffscreenRecorder,
  session,
  now = Date.now(),
}) => {
  if (!hasOffscreenRecorder || !session) return false;
  if (!FINALIZING_STATUSES.has(session.status)) return false;
  const at = Number(session.updatedAt);
  if (Number.isFinite(at) && at > 0 && now - at > STALE_SESSION_MS) {
    return false;
  }
  return true;
};

// Resolves { held, waitedMs, refused }. `onHold` fires once when the wait
// begins, so the caller can tell the user why.
export const holdForPreviousRecorder = async ({
  read,
  onHold = () => {},
  timeoutMs = HOLD_TIMEOUT_MS,
  pollMs = HOLD_POLL_MS,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = Date.now,
}) => {
  const startedAt = now();
  if (!isPreviousRecorderFinalizing({ ...(await read()), now: now() })) {
    return { held: false, waitedMs: 0, refused: false };
  }
  onHold();
  while (now() - startedAt < timeoutMs) {
    await sleep(pollMs);
    if (!isPreviousRecorderFinalizing({ ...(await read()), now: now() })) {
      return { held: true, waitedMs: now() - startedAt, refused: false };
    }
  }
  return { held: true, waitedMs: now() - startedAt, refused: true };
};

export const readPreviousRecorderState = async () => {
  let hasOffscreenRecorder = false;
  try {
    const contexts = await chrome.runtime.getContexts({});
    hasOffscreenRecorder = (contexts || []).some(
      (c) =>
        c.contextType === "OFFSCREEN_DOCUMENT" &&
        typeof c.documentUrl === "string" &&
        c.documentUrl.includes("offscreenrecorder.html")
    );
  } catch {}
  const { recorderSession } = await chrome.storage.local.get([
    "recorderSession",
  ]);
  return { hasOffscreenRecorder, session: recorderSession || null };
};
