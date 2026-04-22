// SW analog of emitUploadTelemetry; fire-and-forget to /log/upload-event.

const API_BASE = process.env.SCREENITY_API_BASE_URL;
const ENDPOINT = `${API_BASE}/log/upload-event`;

let disabled = false;

const getOsName = () => {
  const p =
    (typeof navigator !== "undefined" && navigator.platform) || "";
  if (p.includes("Mac")) return "macOS";
  if (p.includes("Win")) return "Windows";
  if (p.includes("Linux")) return "Linux";
  return "Other";
};

const getBrowserName = () => {
  const ua =
    (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  return "Other";
};

const getBrowserMajor = () => {
  const ua =
    (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const m = ua.match(/Chrome\/([0-9]+)/);
  return m ? parseInt(m[1], 10) : null;
};

export const emitRecordingTelemetry = async (eventType, extra = {}) => {
  if (disabled) return;
  if (!API_BASE) return;
  try {
    const snap = await chrome.storage.local.get([
      "recordingSessionId",
      "recorderSession",
      "screenityToken",
    ]);
    const session = snap.recorderSession || null;
    const recordingSessionId =
      extra.recordingSessionId ||
      session?.recordingSessionId ||
      session?.id ||
      snap.recordingSessionId ||
      null;
    if (!recordingSessionId) return;

    const screenUploader = session?.tracks?.screen?.uploader || null;
    const cameraUploader = session?.tracks?.camera?.uploader || null;
    const mediaId =
      extra.mediaId ||
      screenUploader?.mediaId ||
      cameraUploader?.mediaId ||
      null;

    const extVersion = chrome?.runtime?.getManifest?.()?.version || null;

    const body = JSON.stringify({
      recordingId: mediaId,
      recordingSessionId,
      projectId: extra.projectId || session?.projectId || null,
      sceneId: extra.sceneId || session?.sceneId || null,
      mediaId,
      source: "extension",
      extVersion,
      env: {
        os: getOsName(),
        browser: getBrowserName(),
        browserMajor: getBrowserMajor(),
        appVersion: null,
      },
      event: {
        type: eventType,
        t: Date.now(),
        ...extra,
        recordingSessionId,
        projectId: extra.projectId || session?.projectId || null,
        sceneId: extra.sceneId || session?.sceneId || null,
        mediaId,
      },
    });

    const headers = {
      "Content-Type": "application/json",
      "x-screenity-source": "extension",
    };
    if (extVersion) headers["x-screenity-ext-version"] = String(extVersion);
    if (snap.screenityToken) {
      headers.Authorization = `Bearer ${snap.screenityToken}`;
    }

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      credentials: "include",
      keepalive: true,
      body,
    });
    if (res.status === 404 || res.status === 405) {
      disabled = true;
    }
  } catch {
    // best-effort
  }
};
