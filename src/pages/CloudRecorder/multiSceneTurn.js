// Multi mode files each take after the scene before it, using the count and
// last scene id the previous take wrote after its scene POST. A take that
// stops while the previous one is still finishing must wait for that write,
// or both claim the same count and the later take is filed first.
//
// The turn is a Web Lock per project, requested at Stop, so turns are granted
// in stop order across the host's frames and recorder tabs (one origin). A
// frame that dies drops its lock, so a crashed take never strands the next.
const LOCK_PREFIX = "screenity-multi-scene:";

// Only a safety net: the previous take's finalize has its own budgets.
export const MULTI_SCENE_TURN_MAX_WAIT_MS = 5 * 60 * 1000;

export const claimMultiSceneTurn = (projectId, locks = globalThis.navigator?.locks) => {
  if (!projectId || typeof locks?.request !== "function") return null;
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const granted = new Promise((resolve) => {
    Promise.resolve()
      .then(() =>
        locks.request(`${LOCK_PREFIX}${projectId}`, () => {
          resolve();
          return held;
        })
      )
      .catch(() => resolve());
  });
  return { granted, release };
};

export const waitForMultiSceneTurn = (turn, maxWaitMs = MULTI_SCENE_TURN_MAX_WAIT_MS) => {
  if (!turn) return Promise.resolve();
  let timer = null;
  return Promise.race([
    turn.granted,
    new Promise((resolve) => {
      timer = setTimeout(resolve, maxWaitMs);
    }),
  ]).finally(() => clearTimeout(timer));
};

// The live multi keys, when they still belong to this take's project and are
// ahead of the Stop-time copy. A new session's reset never moves a take back.
export const pickMultiSceneState = (snapshot, live, projectId) => {
  const base = {
    multiSceneCount: snapshot?.multiSceneCount || 0,
    multiLastSceneId: snapshot?.multiLastSceneId || null,
  };
  if (!live || !projectId || live.projectId !== projectId) return base;
  const liveCount = Number(live.multiSceneCount) || 0;
  if (liveCount <= base.multiSceneCount) return base;
  return {
    multiSceneCount: liveCount,
    multiLastSceneId: live.multiLastSceneId || base.multiLastSceneId,
  };
};
