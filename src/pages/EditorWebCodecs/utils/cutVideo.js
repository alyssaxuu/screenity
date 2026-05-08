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

  // Edge cuts collapse to a single range; delegate to trimmer for stream-copy.
  // Trimmer snaps START back to the prior keyframe, so cutting [0, endTime]
  // can re-include up to one GOP (~1s) of "deleted" content. Accepted trade
  // because stream-copy is multi-second faster than re-encode.
  const EPS = 0.05;
  if (cut && startTime <= EPS) {
    const trimmer = new VideoTrimmer();
    result = await trimmer.trim(videoBlob, {
      startTime: endTime,
      endTime: duration ?? Number.POSITIVE_INFINITY,
      outputFormat: "mp4",
      onProgress,
    });
  } else if (cut && duration && endTime >= duration - EPS) {
    const trimmer = new VideoTrimmer();
    result = await trimmer.trim(videoBlob, {
      startTime: 0,
      endTime: startTime,
      outputFormat: "mp4",
      onProgress,
    });
  } else if (cut) {
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
