async function getAudio(ffmpeg, videoBlob) {
  try {
    // Set the input video file name
    ffmpeg.FS("writeFile", "input.mp4", videoBlob);

    // Define the output audio file name
    const outputAudioFileName = "output-audio.wav";

    // Run FFmpeg to extract audio from the video
    await ffmpeg.run(
      "-i",
      "input.mp4",
      "-q:a",
      "0",
      "-map",
      "a",
      outputAudioFileName
    );

    // Get the extracted audio data
    const audioData = ffmpeg.FS("readFile", outputAudioFileName);

    // Create a Blob from the audio data
    const audioBlob = new Blob([audioData.buffer], { type: "audio/wav" });

    // Return the audio Blob
    return audioBlob;
  } catch (error) {
    console.error("Error extracting audio from video:", error);
  }
}

export default getAudio;
