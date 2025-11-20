async function hasAudio(ffmpeg, videoBlob) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;

    video.addEventListener("loadedmetadata", () => {
      if (typeof video.mozHasAudio !== "undefined") {
        const result = video.mozHasAudio;
        URL.revokeObjectURL(video.src);
        resolve(result);
        return;
      }

      if (typeof video.webkitAudioDecodedByteCount !== "undefined") {
        const result = video.webkitAudioDecodedByteCount > 0;
        URL.revokeObjectURL(video.src);
        resolve(result);
        return;
      }

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      video
        .play()
        .then(() => {
          const source = audioContext.createMediaElementSource(video);
          const analyser = audioContext.createAnalyser();
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);

          const hasAudioData = dataArray.some((v) => v > 0);

          video.pause();
          URL.revokeObjectURL(video.src);
          audioContext.close();

          resolve(hasAudioData);
        })
        .catch(() => {
          URL.revokeObjectURL(video.src);
          audioContext.close();
          resolve(true);
        });
    });

    video.addEventListener("error", (e) => {
      URL.revokeObjectURL(video.src);
      reject(new Error(`Video error: ${e.message || "Unknown error"}`));
    });

    video.src = URL.createObjectURL(videoBlob);
    video.load();
  });
}

export default hasAudio;
