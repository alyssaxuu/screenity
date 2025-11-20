async function muteVideo(ffmpeg, videoBlob, start, end) {
  try {
    const videoData = new Uint8Array(await videoBlob.arrayBuffer());

    // Set the input video file name
    ffmpeg.FS("writeFile", "input.mp4", videoData);

    // Set the output video file name
    const outputFileName = "output.mp4";

    // Mute the audio in the specified time range
    await ffmpeg.run(
      "-i",
      "input.mp4",
      "-af",
      `volume='if(between(t,${start},${end}),0,1)':eval=frame`,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      outputFileName
    );

    // Get the edited video data
    const data = ffmpeg.FS("readFile", outputFileName);

    // Create a Blob from the edited video data
    const editedVideoBlob = new Blob([data.buffer], { type: "video/mp4" });

    // Return the edited video Blob
    return editedVideoBlob;
  } catch (error) {
    console.error("Error muting video:", error);
    return null;
  }
}

export default muteVideo;
