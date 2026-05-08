async function addAudioToVideo(
  ffmpeg,
  videoBlob,
  audioBlob,
  videoDuration,
  audioVolume = 1.0,
  replaceAudio = false
) {
  if (audioBlob.size > 50_000_000) {
    throw new Error("background-audio-too-large");
  }
  const videoData = new Uint8Array(await videoBlob.arrayBuffer());
  const audioData = new Uint8Array(await audioBlob.arrayBuffer());

  ffmpeg.FS("writeFile", "input-video.mp4", videoData);
  ffmpeg.FS("writeFile", "input-audio.mp3", audioData);

  const outputFileName = "output-with-audio.mp4";

  let ffmpegCommand = [
    "-i",
    "input-video.mp4",
    "-i",
    "input-audio.mp3",
    "-filter_complex",
    `[0:a]volume=1[a];[1:a]volume=${audioVolume}[b];[a][b]amix=inputs=2:duration=first:dropout_transition=2[v]`,
    "-map",
    "0:v",
    "-map",
    "[v]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-strict",
    "experimental",
    "-shortest",
    outputFileName,
  ];

  if (replaceAudio) {
    ffmpegCommand = [
      "-i",
      "input-video.mp4",
      "-i",
      "input-audio.mp3",
      "-filter_complex",
      "[0:a]volume=0[a];[1:a]volume=1[b];[a][b]amix=inputs=2:duration=first:dropout_transition=2[v]",
      "-map",
      "0:v",
      "-map",
      "[v]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-strict",
      "experimental",
      "-shortest",
      outputFileName,
    ];
  }

  await ffmpeg.run(...ffmpegCommand);

  const data = ffmpeg.FS("readFile", outputFileName);

  const videoWithAudioBlob = new Blob([data.buffer], { type: "video/mp4" });

  return videoWithAudioBlob;
}

export default addAudioToVideo;
