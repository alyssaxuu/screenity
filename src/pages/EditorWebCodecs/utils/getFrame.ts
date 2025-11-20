async function getFrame(ffmpeg, videoBlob, time) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    video.addEventListener("loadedmetadata", () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = time;
    });

    video.addEventListener("seeked", () => {
      try {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(video.src);
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob from canvas"));
        }, "image/png");
      } catch (error) {
        URL.revokeObjectURL(video.src);
        reject(error);
      }
    });

    video.addEventListener("error", (e) => {
      URL.revokeObjectURL(video.src);
      reject(new Error(`Video error: ${e.message || "Unknown error"}`));
    });

    video.src = URL.createObjectURL(videoBlob);
  });
}

export default getFrame;
