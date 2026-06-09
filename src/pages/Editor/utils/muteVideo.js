import { VideoMuter } from "../mediabunny/lib/videoMuter.ts";

async function muteVideo(
  ffmpeg,
  videoBlob,
  startTime,
  endTime,
  duration,
  onProgress = () => {}
) {
  const muter = new VideoMuter();

  return muter.mute(videoBlob, {
    muteStart: startTime,
    muteEnd: endTime,
    outputFormat: "webm",
    videoBitrate: 5_000_000,
    audioBitrate: 128_000,
    onProgress,
  });
}

export default muteVideo;
