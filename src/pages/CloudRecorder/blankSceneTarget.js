// Mirrors the server's empty-scene test in POST /videos/:id/scenes: a
// project's first scene stays blank until a take fills it.
export const isBlankScene = (scene) =>
  Boolean(scene) &&
  !scene.screen &&
  !scene.camera &&
  scene.type !== "template" &&
  (!Array.isArray(scene.overlays) || scene.overlays.length === 0);

// The server fills insertAfterSceneId in place when it is blank, else appends.
// An unknown target (a scene only the editor holds) or none appends too,
// leaving a blank scene beside the take.
export const pickInsertTarget = ({ project, insertAfterSceneId }) => {
  const order = project?.data?.sceneOrder;
  const scenes = project?.data?.scenes;
  if (!Array.isArray(order) || !scenes || typeof scenes !== "object") {
    return insertAfterSceneId ?? null;
  }
  if (insertAfterSceneId && scenes[insertAfterSceneId])
    return insertAfterSceneId;
  return order.find((id) => isBlankScene(scenes[id])) ?? null;
};

// Fails open: any miss keeps the caller's target.
export const resolveInsertTarget = async ({
  projectId,
  insertAfterSceneId = null,
  apiBase,
  token,
  fetchImpl = fetch,
  timeoutMs = 3000,
}) => {
  if (!projectId || !apiBase) return insertAfterSceneId;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${apiBase}/videos/${projectId}/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    if (!res.ok) return insertAfterSceneId;
    const body = await res.json();
    return pickInsertTarget({
      project: body?.video || body,
      insertAfterSceneId,
    });
  } catch {
    return insertAfterSceneId;
  } finally {
    clearTimeout(timer);
  }
};
