// pendingSceneIndex read-modify-write for the recorder's pending scenes.
const INDEX_KEY = "pendingSceneIndex";

const readIndex = async () => {
  const raw = await chrome.storage.local.get([INDEX_KEY]);
  // A stored null skips destructure defaults, so coerce.
  return Array.isArray(raw?.[INDEX_KEY]) ? raw[INDEX_KEY] : [];
};

// One in-process queue so a get-then-set never interleaves with another.
let queue = Promise.resolve();
const serialized = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

export const upsertPendingScene = (sceneId, payload) =>
  serialized(async () => {
    if (!sceneId) return;
    const index = await readIndex();
    await chrome.storage.local.set({
      [`pendingScene:${sceneId}`]: {
        ...payload,
        sceneId,
        createdAt: payload?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      },
      [INDEX_KEY]: index.includes(sceneId) ? index : [...index, sceneId],
    });
  });

export const removePendingScene = (sceneId) =>
  serialized(async () => {
    if (!sceneId) return;
    const index = await readIndex();
    await chrome.storage.local.remove([`pendingScene:${sceneId}`]);
    await chrome.storage.local.set({
      [INDEX_KEY]: index.filter((id) => id !== sceneId),
    });
  });

export const MAX_RECOVERY_ATTEMPTS = 5;
export const MAX_PENDING_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Read-only: true when the payload is past the age backstop.
export const pendingSceneExpired = async (sceneId) => {
  const key = `pendingScene:${sceneId}`;
  const pending = (await chrome.storage.local.get([key]))?.[key];
  if (!pending) return false;
  const born = pending.createdAt ?? pending.updatedAt ?? Date.now();
  return Date.now() - born > MAX_PENDING_AGE_MS;
};

// Counts one definite server refusal; a racing recorder can only undercount.
export const countRecoveryFailure = (sceneId) =>
  serialized(async () => {
    const key = `pendingScene:${sceneId}`;
    const pending = (await chrome.storage.local.get([key]))?.[key];
    if (!pending) return 0;
    const attempts = (pending.attempts || 0) + 1;
    await chrome.storage.local.set({ [key]: { ...pending, attempts } });
    return attempts;
  });
