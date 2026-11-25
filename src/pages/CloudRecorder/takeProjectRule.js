// Whether a thrown-away take may delete its whole project, or only its own
// uploads. The server's full delete releases every media the project holds, so
// it is only safe for a project this Start created and nothing else uses:
// - a reused project (multi take 2 while take 1 is still finishing, a take held
//   for Retry, adding a scene) holds another take's media;
// - a restart keeps recording into it (a cancel in its countdown is a plain
//   dismiss, and the stamp above still keeps a reused project);
// - a later Start that reused it is recording into it now.
// The background's discard-empty request still drops an empty shell after a
// plain countdown cancel; the server checks that one.

// Read live, at the moment of the delete.
export const LIVE_PROJECT_KEYS = [
  "projectId",
  "multiProjectId",
  "startCreatedProjectId",
];

export const takeMayDeleteProject = ({
  projectId,
  startCreatedProjectId,
  recordingToScene,
  multiMode,
  multiSceneCount,
  restarting = false,
  live = null,
}) => {
  if (!projectId || restarting || recordingToScene) return false;
  if (startCreatedProjectId !== projectId) return false;
  if (multiMode && (multiSceneCount || 0) > 0) return false;
  // Unreadable storage: no way to tell whether a later Start took it over.
  if (!live) return false;
  const stillLive =
    live.projectId === projectId || live.multiProjectId === projectId;
  if (stillLive && live.startCreatedProjectId !== projectId) return false;
  return true;
};
