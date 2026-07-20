import { VideoCropper } from "../mediabunny/lib/videoCropper.ts";

async function cropVideo(
  ffmpeg,
  videoBlob,
  cropOptions,
  onProgress = () => {}
) {
  const cropper = new VideoCropper();

  return cropper.crop(videoBlob, {
    left: cropOptions.x,
    top: cropOptions.y,
    width: cropOptions.width,
    height: cropOptions.height,
    // Omit outputFormat so the crop follows the input container, like the trimmer.
    // Forcing "webm" cropped MP4 recordings to WebM, then mislabelled downstream.
    videoBitrate: 5_000_000,
    audioBitrate: 128_000,
    onProgress,
  });
}

export default cropVideo;
