const hasAudio = async (videoBlob) => {
  const videoElement = document.createElement("video");
  videoElement.src = URL.createObjectURL(videoBlob);

  return new Promise(async (resolve, reject) => {
    try {
      videoElement.addEventListener("loadedmetadata", async () => {
        try {
          const mediaSource = new MediaSource();
          videoElement.src = URL.createObjectURL(mediaSource);
          await mediaSource.addSourceBuffer(videoBlob.type);

          mediaSource.onsourceopen = () => {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaElementSource(videoElement);

            source.connect(audioContext.destination);
            source.onended = () => {
              // If audio plays and ends, it has audio tracks
              resolve(true);
            };
            source.onerror = () => {
              // If there's an error, it doesn't have audio tracks
              resolve(false);
            };

            // Start playing the video
            videoElement.play();
          };
        } catch (error) {
          resolve(false); // MediaSource or AudioContext not supported
        }
      });

      videoElement.addEventListener("error", (error) => {
        reject(error);
      });

      videoElement.load();
    } catch (error) {
      reject(error);
    } finally {
      URL.revokeObjectURL(videoElement.src);
    }
  });
};

export default hasAudio;
