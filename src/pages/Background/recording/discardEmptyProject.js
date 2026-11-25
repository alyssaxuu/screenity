// A countdown cancel throws away the project made at Start. The recorder's own
// delete runs in the document this discard closes and often never goes out, so
// the background asks too, after that document is gone. The server only deletes
// a hidden project nothing landed in (checked in the delete's filter), so a
// second ask is harmless. Older servers have no discard-empty route (404).

// Must match countdownCancelReason in pages/utils (a restart's differs).
const COUNTDOWN_CANCELLED = "countdown-cancelled";

// discardRecording reads these before the dismiss, which removes projectId and
// the multi keys.
export const SHELL_TARGET_KEYS = [
  "projectId",
  "recordingToScene",
  "multiMode",
  "multiSceneCount",
  "multiProjectId",
  "restarting",
  // The project this Start created, null when it reused one (see CloudRecorder).
  "startCreatedProjectId",
];

// Mirrors the recorder's own dismiss rule.
const shellTargetId = ({ reason, projectId, snapshot = {} }) => {
  if (reason !== COUNTDOWN_CANCELLED || snapshot.restarting) return null;
  // Adding a scene to an existing project: that project is never ours to drop.
  if (snapshot.recordingToScene) return null;
  // A later multi take records into the project that holds the first one.
  if (snapshot.multiMode && snapshot.multiSceneCount > 0) return null;
  const target =
    projectId ||
    snapshot.projectId ||
    (snapshot.multiMode ? snapshot.multiProjectId : null) ||
    null;
  // A reused project can hold a take from an earlier Start still uploading or
  // held for Retry.
  if (!target || snapshot.startCreatedProjectId !== target) return null;
  return target;
};

// Resolves to "deleted", "kept", "skipped" or "failed". Never throws.
export const discardEmptyProject = async ({
  reason,
  projectId = null,
  snapshot,
  apiBase = process.env.SCREENITY_API_BASE_URL,
  fetchImpl = (...args) => fetch(...args),
}) => {
  const target = shellTargetId({ reason, projectId, snapshot });
  if (!target || !apiBase) return "skipped";
  try {
    const { screenityToken } = await chrome.storage.local.get(["screenityToken"]);
    if (!screenityToken) return "skipped";
    // Clear first, or a Start in the meantime reuses the project being deleted.
    const current = await chrome.storage.local.get(["projectId", "multiProjectId"]);
    const clear = {};
    if (current.projectId === target) clear.projectId = null;
    if (current.multiProjectId === target) clear.multiProjectId = null;
    if (Object.keys(clear).length) await chrome.storage.local.set(clear);

    const res = await fetchImpl(`${apiBase}/videos/${target}/discard-empty/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${screenityToken}` },
    });
    if (!res?.ok) return "failed";
    const body = await res.json().catch(() => ({}));
    return body?.deleted ? "deleted" : "kept";
  } catch {
    return "failed";
  }
};
