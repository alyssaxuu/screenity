// MediaRecorder codec negotiation + track snapshots, shared by Recorder and
// Region (the same recorder, tab vs iframe). CloudRecorder has its own inline
// mimeType handling (encoder/chooseEncoder.js).

// Prefer MP4 (H.264+AAC) for the MediaRecorder fallback, matching the free
// Recorder and CloudRecorder. VFR VP9/WebM breaks downstream (Bunny drops
// frames, node-av SIGSEGVs). false = VP9-WebM.
const PREFER_MP4_MEDIARECORDER = true;
// avc1 Baseline + AAC-LC, same string the free Recorder uses.
const MP4_MIME = "video/mp4;codecs=avc1.42E01E,mp4a.40.2";

// isTypeSupported(avc1) true does not guarantee start() succeeds: some
// Windows/Chrome installs advertise the mime and then throw NotSupportedError
// from start(), which killed the whole recording. Probe the real stream.
export const canStartMp4Recorder = (stream, mime) => {
  if (!stream || typeof MediaRecorder === "undefined") return true;
  let probe = null;
  try {
    probe = new MediaRecorder(stream, { mimeType: mime });
    probe.start();
    return true;
  } catch {
    return false;
  } finally {
    try {
      if (probe && probe.state !== "inactive") probe.stop();
    } catch {}
  }
};

// Primary start passes "mp4" (falls through to WebM if unsupported); the
// runtime downgrade passes "vp8" and must stay WebM.
export const selectMimeType = (preferredCodec, stream = null) => {
  const preferred = (preferredCodec || "").toLowerCase();
  const webmTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm;codecs=avc1",
    "video/webm;codecs=h264",
    "video/webm",
  ];
  const wantsWebmCodec =
    preferred.includes("vp8") ||
    preferred.includes("vp9") ||
    preferred === "webm";
  const offerMp4 =
    PREFER_MP4_MEDIARECORDER &&
    !wantsWebmCodec &&
    canStartMp4Recorder(stream, MP4_MIME)
      ? [MP4_MIME]
      : [];

  const orderedWebm = preferred
    ? webmTypes
        .filter((type) => type.includes(preferred))
        .concat(webmTypes.filter((type) => !type.includes(preferred)))
    : webmTypes;

  const ordered = [...offerMp4, ...orderedWebm];
  return ordered.find((type) => MediaRecorder.isTypeSupported(type)) || null;
};

export const getCodecLabel = (mimeType) => {
  if (!mimeType) return "unknown";
  if (mimeType.includes("vp9")) return "vp9";
  if (mimeType.includes("vp8")) return "vp8";
  if (mimeType.includes("avc1") || mimeType.includes("h264")) return "h264";
  return "unknown";
};

export function buildTrackSnapshot(track) {
  if (!track) return null;
  const settings =
    typeof track.getSettings === "function" ? track.getSettings() : {};
  const constraints =
    typeof track.getConstraints === "function" ? track.getConstraints() : {};
  const capabilities =
    typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
  return {
    label: track.label,
    settings,
    constraints,
    capabilities,
  };
}
