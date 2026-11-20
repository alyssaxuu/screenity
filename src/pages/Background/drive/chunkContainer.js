// fMP4 when WebCodecs recorded it, WebM when MediaRecorder did. Sniff the bytes
// (ftyp at offset 4 is MP4, EBML magic is WebM); the blob type is only a fallback.
export const sniffContainer = async (firstPart) => {
  try {
    const head = new Uint8Array(await firstPart.slice(0, 12).arrayBuffer());
    if (
      head.length >= 8 &&
      head[4] === 0x66 &&
      head[5] === 0x74 &&
      head[6] === 0x79 &&
      head[7] === 0x70
    ) {
      return { mime: "video/mp4", ext: ".mp4" };
    }
    if (
      head.length >= 4 &&
      head[0] === 0x1a &&
      head[1] === 0x45 &&
      head[2] === 0xdf &&
      head[3] === 0xa3
    ) {
      return { mime: "video/webm", ext: ".webm" };
    }
  } catch {}
  if (String(firstPart?.type || "").includes("mp4")) {
    return { mime: "video/mp4", ext: ".mp4" };
  }
  return { mime: "video/webm", ext: ".webm" };
};
