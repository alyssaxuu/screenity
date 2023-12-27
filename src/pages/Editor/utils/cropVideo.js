async function cropVideo(ffmpeg, videoBlob, cropParameters) {
  const videoData = new Uint8Array(await videoBlob.arrayBuffer());

  // Set the input video file name
  ffmpeg.FS("writeFile", "input.mp4", videoData);

  // Set the output video file name
  const outputFileName = "output-cropped.mp4";

  // Build FFmpeg command for cropping
  const ffmpegCommand = [
    "-i",
    "input.mp4",
    "-vf",
    `crop=${cropParameters.width}:${cropParameters.height}:${cropParameters.x}:${cropParameters.y}`,
    "-c:a",
    "copy",
    "-preset",
    "superfast",
    "-threads",
    "0",
    "-r",
    "30",
    "-tune",
    "fastdecode",
    outputFileName,
  ];

  // Run FFmpeg to crop the video
  await ffmpeg.run(...ffmpegCommand);

  // Get the cropped video data
  const data = ffmpeg.FS("readFile", outputFileName);

  // Create a Blob from the cropped video data
  const croppedVideoBlob = new Blob([data.buffer], { type: "video/mp4" });

  // Return the cropped video Blob
  return croppedVideoBlob;
}

export default cropVideo;
