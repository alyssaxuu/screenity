/* getFrame.js */
async function getFrame(ffmpeg, videoBlob, time = 0) {
  const videoData = new Uint8Array(await videoBlob.arrayBuffer());
  // Write video data to a file
  ffmpeg.FS("writeFile", "input.mp4", videoData);

  const outputFileName = "output.jpg";

  // Use FFmpeg to extract a frame as a JPEG image
  await ffmpeg.run(
    "-i",
    "input.mp4",
    "-ss",
    time.toString(),
    "-frames:v",
    "1",
    "-preset",
    "superfast",
    "-threads",
    "0",
    "-r",
    "30",
    "-tune",
    "fastdecode",
    outputFileName
  );

  // Read the generated frame image
  const frameData = ffmpeg.FS("readFile", outputFileName);

  // Create a Blob from the frame data
  const frameBlob = new Blob([frameData.buffer], {
    type: "image/jpeg",
  });

  // Clean up
  ffmpeg.FS("unlink", "input.mp4");
  ffmpeg.FS("unlink", outputFileName);

  return frameBlob;
}

export default getFrame;
