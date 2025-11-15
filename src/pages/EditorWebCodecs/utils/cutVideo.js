import { VideoTrimmer } from "../mediabunny/lib/videoTrimmer.ts";
import { VideoCutter } from "../mediabunny/lib/videoCutter.ts";

export default async function cutVideo(
  ffmpeg,
  videoBlob,
  startTime,
  endTime,
  cut,
  duration,
  encode,
  onProgress = () => {}
) {
  let result;

  if (cut) {
    const cutter = new VideoCutter();
    result = await cutter.cut(videoBlob, {
      cutStart: startTime,
      cutEnd: endTime,
      outputFormat: "mp4",
      videoBitrate: 5_000_000,
      audioBitrate: 128_000,
      onProgress,
    });
  } else {
    const trimmer = new VideoTrimmer();
    result = await trimmer.trim(videoBlob, {
      startTime,
      endTime,
      outputFormat: "mp4",
      videoBitrate: 5_000_000,
      audioBitrate: 128_000,
      onProgress,
    });
  }

  return result;
}
