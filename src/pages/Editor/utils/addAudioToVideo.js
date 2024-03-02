async function addAudioToVideo(
  ffmpeg,
  videoBlob,
  audioBlob,
  videoDuration,
  audioVolume = 1.0,
  replaceAudio = false
) {
  const videoData = new Uint8Array(await videoBlob.arrayBuffer());
  const audioData = new Uint8Array(await audioBlob.arrayBuffer());

  // Set the input video and audio file names
  ffmpeg.FS("writeFile", "input-video.mp4", videoData);
  ffmpeg.FS("writeFile", "input-audio.mp3", audioData);

  // Set the output video file name
  const outputFileName = "output-with-audio.mp4";

  // Build FFmpeg command for merging video and audio with volume adjustment
  let ffmpegCommand = [
    "-i",
    "input-video.mp4",
    "-i",
    "input-audio.mp3",
    "-filter_complex",
    `[0:a]volume=1[a];[1:a]volume=${audioVolume}[b];[a][b]amix=inputs=2:duration=first:dropout_transition=2[v]`,
    "-map",
    "0:v", // Map the original video stream
    "-map",
    "[v]", // Map the merged audio
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
    // Remove the original audio stream and replace it with the audio from the audio blob
    ffmpegCommand = [
      "-i",
      "input-video.mp4",
      "-i",
      "input-audio.mp3",
      "-filter_complex",
      "[0:a]volume=0[a];[1:a]volume=1[b];[a][b]amix=inputs=2:duration=first:dropout_transition=2[v]",
      "-map",
      "0:v", // Map the original video stream
      "-map",
      "[v]", // Map the merged audio
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

  // Run FFmpeg to merge video and audio with volume adjustment
  await ffmpeg.run(...ffmpegCommand);

  // Get the merged video data
  const data = ffmpeg.FS("readFile", outputFileName);

  // Create a Blob from the merged video data
  const videoWithAudioBlob = new Blob([data.buffer], { type: "video/mp4" });

  // Return the video with merged audio Blob
  return videoWithAudioBlob;
}

export default addAudioToVideo;
