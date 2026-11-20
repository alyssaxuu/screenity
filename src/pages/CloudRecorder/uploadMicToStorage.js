// Mic upload for separated-audio scenes: Bunny Storage, not Stream over TUS.
// Stream measures length from the video stream, so an audio-only file lands
// with duration 1, a 0-byte play_720p and no plain URL for the editor.
// The upload also records `audioLayout` on the media, which is what marks
// the scene separated. One POST at stop, not incremental PATCHes;
// micRecovery.js covers the tab dying during it.
const API_BASE = process.env.SCREENITY_API_BASE_URL;

// The server's audio cap, which is also its per-request memory ceiling (it
// buffers the whole body). Over six hours at 96 kbps. Checked here so an
// over-long take reports better than a 400.
export const MAX_MIC_UPLOAD_BYTES = 300 * 1024 * 1024;

// The route's per-type MIME allowlist; it rejects video/webm for type audio,
// which is why the separated mic never records as video/webm.
const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
]);

const extensionFor = (mime) => {
  if (mime.startsWith("audio/mp4")) return "m4a";
  if (mime.startsWith("audio/ogg")) return "ogg";
  return "webm";
};

// Chunk `.type` carries a codecs suffix ("audio/webm;codecs=opus"); the route
// compares the bare type.
export const baseMimeOf = (type) => String(type || "").split(";")[0].trim();

export const collectMicChunks = async (store, prefix = "audio_chunk_") => {
  const parts = [];
  await store.iterate((value, key) => {
    if (!key.startsWith(prefix)) return;
    if (!value?.chunk) return;
    parts.push({ index: Number(value.index), chunk: value.chunk });
  });
  parts.sort((a, b) => a.index - b.index);
  return parts.map((p) => p.chunk);
};

// The shared IDB audio store holds whichever take wrote it last, each chunk tagged with its session.
// A debt may only send its own: other takes' chunks are their voice, and `foreign` says the store must
// not be cleared on this debt's account. Untagged chunks are a legacy store's, taken only when nothing
// is tagged; with no sessionId every chunk is taken as before.
// The tags a marker's own chunks can carry: the store's id, the recorder session, and (for a marker
// written without it) the id of the snapshot whose store this is.
export const ownChunkTags = (marker, all = {}) => {
  const tags = new Set();
  if (marker?.sessionId) tags.add(marker.sessionId);
  if (marker?.chunkTagId) tags.add(marker.chunkTagId);
  if (marker?.sessionId) {
    for (const [k, v] of Object.entries(all || {})) {
      if (k.startsWith("cloudRecorderSession:") && v?.opfsSessionId === marker.sessionId && v.id) {
        tags.add(v.id);
      }
    }
  }
  return [...tags];
};

export const collectMicChunksFor = async (
  store,
  sessionIds,
  prefix = "audio_chunk_"
) => {
  const parts = [];
  await store.iterate((value, key) => {
    if (!key.startsWith(prefix)) return;
    if (!value?.chunk) return;
    parts.push({
      index: Number(value.index),
      chunk: value.chunk,
      tag: typeof value.sessionId === "string" ? value.sessionId : null,
    });
  });
  parts.sort((a, b) => a.index - b.index);
  const ids = new Set([].concat(sessionIds || []).filter(Boolean));
  if (!ids.size) return { chunks: parts.map((p) => p.chunk), foreign: false };
  const anyTagged = parts.some((p) => p.tag);
  const own = parts.filter((p) => (anyTagged ? ids.has(p.tag) : true));
  return {
    chunks: own.map((p) => p.chunk),
    foreign: parts.some((p) => p.tag && !ids.has(p.tag)),
  };
};

/**
 * POST the mic recording to Bunny Storage and return its media doc. Resolves
 * { ok: false, reason } rather than throwing: the mic is supplementary and must
 * never take the scene down with it.
 */
export const uploadMicToStorage = async ({
  chunks,
  mimeType,
  sceneId,
  projectId = null,
  duration = null,
  token,
  fetchImpl = fetch,
}) => {
  if (!API_BASE) return { ok: false, reason: "no-api-base" };
  if (!token) return { ok: false, reason: "no-token" };
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { ok: false, reason: "no-chunks" };
  }

  const base = baseMimeOf(mimeType);
  if (!ALLOWED_AUDIO_MIME.has(base)) {
    return { ok: false, reason: `unsupported-mime-${base || "unknown"}` };
  }

  // Retyped to the bare MIME: the codecs suffix fails the route's allowlist,
  // and Bunny types the stored file by extension anyway.
  const blob = new Blob(chunks, { type: base });
  if (blob.size === 0) return { ok: false, reason: "empty-blob" };
  if (blob.size > MAX_MIC_UPLOAD_BYTES) {
    return { ok: false, reason: "too-large", bytes: blob.size };
  }

  const form = new FormData();
  form.append("file", blob, `mic-${sceneId || Date.now()}.${extensionFor(base)}`);
  form.append("type", "audio");
  form.append("audioLayout", "separated");
  if (sceneId) form.append("sceneId", String(sceneId));
  if (projectId) form.append("projectId", String(projectId));
  if (typeof duration === "number" && duration > 0) {
    form.append("duration", String(duration));
  }

  try {
    const res = await fetchImpl(`${API_BASE}/bunny/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}`, status: res.status, text };
    }
    const mediaId = body?.mediaId || body?.media?._id || body?.data?.mediaId || null;
    const url = body?.url || body?.media?.src || body?.data?.url || null;
    if (!mediaId) return { ok: false, reason: "no-media-id", text };
    return { ok: true, mediaId, url, bytes: blob.size };
  } catch (err) {
    return { ok: false, reason: err?.message || String(err) };
  }
};

/**
 * Point an already-created scene at its mic media. Fill-only; answers
 * 200 { attached: false } for a filled slot, a repeat or a deleted scene,
 * so callers need no special-casing.
 */
export const attachSceneAudio = async ({
  projectId,
  sceneId,
  audioMediaId,
  duration = null,
  token,
  fetchImpl = fetch,
}) => {
  if (!API_BASE) return { ok: false, reason: "no-api-base" };
  if (!token) return { ok: false, reason: "no-token" };
  if (!projectId || !sceneId || !audioMediaId) {
    return { ok: false, reason: "missing-ids" };
  }
  try {
    const res = await fetchImpl(
      `${API_BASE}/videos/${projectId}/attach-scene-audio`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sceneId,
          audioMediaId,
          ...(typeof duration === "number" && duration > 0 ? { duration } : {}),
        }),
        keepalive: true,
      },
    );
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {}
    if (!res.ok) {
      return { ok: false, reason: `http-${res.status}`, status: res.status };
    }
    // attached:false with a reason (already-set, scene-missing, ...) means this media is NOT
    // on the scene, so keep the chunks. No reason: the scene already holds this media, settled.
    if (body?.attached === false && body?.reason) {
      return { ok: false, reason: String(body.reason) };
    }
    return { ok: true, attached: body?.attached !== false };
  } catch (err) {
    return { ok: false, reason: err?.message || String(err) };
  }
};
