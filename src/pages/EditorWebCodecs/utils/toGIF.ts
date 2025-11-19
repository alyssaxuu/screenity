import GIF from 'gif';

async function toGIF(ffmpeg, videoBlob, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    video.addEventListener("loadedmetadata", async () => {
      try {
        const duration = video.duration;
        const width = 540;
        const height = Math.round(
          (video.videoHeight / video.videoWidth) * width
        );
        const fps = 12;
        const quality = 5;

        canvas.width = width;
        canvas.height = height;

        const gif = new GIF({
          workers: 2,
          quality,
          width,
          height,
          workerScript: "/assets/vendor/gif.js/gif.worker.js",
        });

        const frameInterval = 1 / fps;
        const totalFrames = Math.floor(duration * fps);
        let frameCount = 0;

        const captureFrame = (time: any) =>
          new Promise((resolveFrame) => {
            const seekHandler = () => {
              video.removeEventListener("seeked", seekHandler);
              ctx.drawImage(video, 0, 0, width, height);
              gif.addFrame(canvas, {
                copy: true,
                delay: Math.round(1000 / fps),
              });
              frameCount++;
              onProgress(frameCount / totalFrames);
              resolveFrame();
            };
            video.addEventListener("seeked", seekHandler);
            video.currentTime = time;
          });

        for (let i = 0; i < totalFrames; i++) {
          const time = Math.min(i * frameInterval, duration - 0.001);
          await captureFrame(time);
        }

        gif.on("finished", (blob) => {
          URL.revokeObjectURL(video.src);
          video.remove();
          onProgress(1);
          resolve(blob);
        });

        gif.on("progress", (progress) => onProgress(progress));

        gif.render();
      } catch (error) {
        URL.revokeObjectURL(video.src);
        video.remove();
        reject(error);
      }
    });

    video.addEventListener("error", (e) => {
      URL.revokeObjectURL(video.src);
      reject(new Error(`Video error: ${e.message || "Unknown error"}`));
    });

    video.src = URL.createObjectURL(videoBlob);
    video.load();
  });
}

export default toGIF;
