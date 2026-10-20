const API_BASE = process.env.SCREENITY_API_BASE_URL;

// What the server is told about the take, besides that it started. Only a 60 fps
// take says anything: 30 is what every project is created with, so sending it
// would change nothing. Tests: tests/unit/notifyRecordingStarted.test.mjs
export const recordingStartedBody = (fps) =>
  fps === 60 ? JSON.stringify({ fps: 60 }) : null;

// Tells app-web a capture is running so its auto-render sweep skips
// this project, and, for a 60 fps take, the frame rate it encodes at so the
// project is not left at the 30 it was created with. The server only raises an
// empty project, so a reused one with media keeps its fps. Scheduling hint
// only: fire and forget, failures stay silent.
export const notifyRecordingStarted = (projectId, { fps } = {}) => {
  if (!projectId || !API_BASE) return;
  (async () => {
    try {
      const { screenityToken } = await chrome.storage.local.get([
        "screenityToken",
      ]);
      const body = recordingStartedBody(fps);
      await fetch(`${API_BASE}/videos/${projectId}/recording-started/`, {
        method: "POST",
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(screenityToken ? { Authorization: `Bearer ${screenityToken}` } : {}),
        },
        ...(body ? { body } : {}),
      });
    } catch {}
  })();
};
