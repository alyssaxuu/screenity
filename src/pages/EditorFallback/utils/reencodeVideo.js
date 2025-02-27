async function reencodeVideo(ffmpeg, blob) {
  const videoData = new Uint8Array(await blob.arrayBuffer());
  const outputFileName = "output.mp4";
  ffmpeg.FS("writeFile", "input.mp4", videoData);
  await ffmpeg.run(
    "-i",
    "input.mp4",
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

  const data = ffmpeg.FS("readFile", outputFileName);
  const editedVideoBlob = new Blob([data.buffer], {
    type: "video/mp4",
  });
  return editedVideoBlob;
}

export default reencodeVideo;
