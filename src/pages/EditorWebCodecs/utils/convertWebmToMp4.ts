import { VideoConverter } from "../mediabunny/lib/videoConverter.ts";

async function convertWebmToMp4(webmBlob, onProgress = () => {}) {
  const converter = new VideoConverter();

  return converter.convertToMP4(webmBlob, {
    videoBitrate: 5_000_000,
    audioBitrate: 128_000,
    onProgress,
  });
}

export default convertWebmToMp4;
