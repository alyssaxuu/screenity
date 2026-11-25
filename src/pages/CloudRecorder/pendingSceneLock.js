// A take's pending scene record is visible to every recorder page from the
// moment it is written, but only an orphan should be recovered. The take that
// is finishing holds a Web Lock on its scene until its scene create settles;
// recovery skips a scene whose lock is held. A frame that dies drops its
// locks, so a crashed take's scene is recoverable at once.
const LOCK_PREFIX = "screenity-pending-scene:";

// Only a safety net: the lock is free unless a recovery of this same scene is
// running in another page.
export const PENDING_SCENE_CLAIM_WAIT_MS = 1000;

const noLock = { granted: Promise.resolve(), release: () => {} };

export const claimPendingScene = (
  sceneId,
  locks = globalThis.navigator?.locks
) => {
  if (!sceneId || typeof locks?.request !== "function") return noLock;
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const granted = new Promise((resolve) => {
    Promise.resolve()
      .then(() =>
        locks.request(`${LOCK_PREFIX}${sceneId}`, () => {
          resolve();
          return held;
        })
      )
      .catch(() => resolve());
  });
  return { granted, release };
};

export const waitForPendingSceneClaim = (
  claim,
  maxWaitMs = PENDING_SCENE_CLAIM_WAIT_MS
) => {
  let timer = null;
  return Promise.race([
    claim.granted,
    new Promise((resolve) => {
      timer = setTimeout(resolve, maxWaitMs);
    }),
  ]).finally(() => clearTimeout(timer));
};

// Runs recover() holding the scene's lock, or returns false without running it
// when another frame holds it. Without Web Locks it runs, as before.
export const recoverUnlessOwned = async (
  sceneId,
  recover,
  locks = globalThis.navigator?.locks
) => {
  if (!sceneId || typeof locks?.request !== "function") {
    await recover();
    return true;
  }
  let ran = false;
  try {
    return await locks.request(
      `${LOCK_PREFIX}${sceneId}`,
      { ifAvailable: true },
      async (lock) => {
        if (!lock) return false;
        ran = true;
        await recover();
        return true;
      }
    );
  } catch (err) {
    // A lock manager that fails is no reason to strand an orphan.
    if (ran) throw err;
    await recover();
    return true;
  }
};
