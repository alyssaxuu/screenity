export const MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=h264",
  "video/webm",
  "video/mp4",
  "video/webm;codecs=avc1",
];

export function getBitrates(quality) {
  switch (quality) {
    case "4k":
      return { audio: 256000, video: 35000000 };
    case "1080p":
      return { audio: 192000, video: 16000000 };
    case "720p":
      return { audio: 128000, video: 8000000 };
    case "480p":
      return { audio: 96000, video: 4000000 };
    case "360p":
      return { audio: 96000, video: 2000000 };
    case "240p":
      return { audio: 64000, video: 1000000 };
    default:
      return { audio: 128000, video: 8000000 };
  }
}
export const VIDEO_QUALITIES = {
  "4k": { width: 4096, height: 2160 },
  "1080p": { width: 1920, height: 1080 },
  "720p": { width: 1280, height: 720 },
  "480p": { width: 854, height: 480 },
  "360p": { width: 640, height: 360 },
  "240p": { width: 426, height: 240 },
  default: { width: 1920, height: 1080 },
};

export function getResolutionForQuality(qualityValue = "default") {
  return VIDEO_QUALITIES[qualityValue] || VIDEO_QUALITIES.default;
}
