// MediaRecorder codec negotiation + track snapshots, shared by Recorder and Region.
// CloudRecorder has its own inline mimeType handling.

export const selectMimeType = (preferredCodec) => {
  const preferred = (preferredCodec || "").toLowerCase();
  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm;codecs=avc1",
    "video/webm;codecs=h264",
    "video/webm",
  ];
  const ordered = preferred
    ? mimeTypes
        .filter((type) => type.includes(preferred))
        .concat(mimeTypes.filter((type) => !type.includes(preferred)))
    : mimeTypes;
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
