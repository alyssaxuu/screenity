import { VideoAudioMixer } from "../mediabunny/lib/videoAudioMixer.ts";

async function ensureBlob(input, mimeType = "video/webm") {
  if (input instanceof Blob) return input;

  if (input && typeof input === "object" && typeof input.size === "number") {
    if (typeof input.arrayBuffer === "function") {
      try {
        const buffer = await input.arrayBuffer();
        return new Blob([buffer], { type: input.type || mimeType });
      } catch {}
    }

    if (typeof input.slice === "function") {
      try {
        const sliced = input.slice(0, input.size, input.type || mimeType);
        if (sliced instanceof Blob) return sliced;
      } catch {}
    }
  }

  throw new Error(
    `Cannot convert to Blob: ${typeof input}, constructor: ${
      input?.constructor?.name
    }`
  );
}

async function addAudioToVideo(
  ffmpeg,
  videoBlob,
  audioBlob,
  videoDuration,
  audioVolume = 1.0,
  replaceAudio = false,
  onProgress
) {
  const video = await ensureBlob(videoBlob, "video/webm");
  const audio = await ensureBlob(audioBlob, "audio/webm");

  const mixer = new VideoAudioMixer();
  return mixer.addAudio(video, audio, {
    mode: replaceAudio ? "replace" : "mix",
    videoVolume: replaceAudio ? 0 : 0.7,
    audioVolume,
    loop: false,
    outputFormat: "webm",
    videoBitrate: 5_000_000,
    audioBitrate: 128_000,
    onProgress,
  });
}

export default addAudioToVideo;
