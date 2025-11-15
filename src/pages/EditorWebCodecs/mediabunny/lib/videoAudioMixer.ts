// @ts-nocheck
import {
  Input,
  BlobSource,
  Output,
  BufferTarget,
  Mp4OutputFormat,
  VideoSampleSource,
  AudioSampleSource,
  VideoSampleSink,
  AudioSample,
  ALL_FORMATS,
  QUALITY_HIGH,
} from "mediabunny";

export class VideoAudioMixer {
  async addAudio(
    videoBlob,
    audioBlob,
    {
      mode = "mix",
      videoVolume = 0.7,
      audioVolume = 0.3,
      loop = false,
      verbose = false,
      onProgress,
    } = {}
  ) {
    const input = new Input({
      source: new BlobSource(videoBlob),
      formats: ALL_FORMATS,
    });

    const outputTarget = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: outputTarget,
    });

    const videoTrack = await input.getPrimaryVideoTrack();
    const videoSink = new VideoSampleSink(videoTrack);
    const videoSource = new VideoSampleSource({
      codec: "avc",
      bitrate: QUALITY_HIGH,
    });
    output.addVideoTrack(videoSource);

    const videoDuration = await this._getDuration(videoBlob);

    const hasVideoAudio = await input
      .getPrimaryAudioTrack()
      .then((t) => !!t)
      .catch(() => false);

    const audioSource = new AudioSampleSource({
      codec: "aac",
      bitrate: 128000,
    });
    output.addAudioTrack(audioSource);

    const bgArrayBuffer = await audioBlob.arrayBuffer();
    const audioCtx = new AudioContext();
    const decodedAudio = await audioCtx.decodeAudioData(bgArrayBuffer);
    const sr = decodedAudio.sampleRate;
    const audioDur = decodedAudio.duration;

    await output.start();

    for await (const frame of videoSink.samples(0, videoDuration)) {
      await videoSource.add(frame);
      frame.close();
      if (onProgress && videoDuration > 0)
        onProgress(frame.timestamp / videoDuration);
    }

    const mixBuffer = new Float32Array(Math.ceil(sr * videoDuration));
    const writeMix = (data, offset, vol) => {
      for (let i = 0; i < data.length && offset + i < mixBuffer.length; i++) {
        mixBuffer[offset + i] += data[i] * vol;
      }
    };

    if (hasVideoAudio && mode === "mix") {
      try {
        const videoArrayBuffer = await videoBlob.arrayBuffer();
        const videoAudioCtx = new AudioContext();
        const decodedVideoAudio = await videoAudioCtx.decodeAudioData(
          videoArrayBuffer
        );
        const videoSamples = decodedVideoAudio.getChannelData(0);
        writeMix(videoSamples, 0, videoVolume);
      } catch {}
    }

    const loopCount = loop
      ? Math.ceil(videoDuration / audioDur)
      : Math.min(1, Math.ceil(videoDuration / audioDur));

    for (let i = 0; i < loopCount; i++) {
      const offset = Math.floor(i * audioDur * sr);
      writeMix(decodedAudio.getChannelData(0), offset, audioVolume);
    }

    const totalSamples = Math.floor(videoDuration * sr);
    const chunkSize = sr * 2;
    let written = 0;

    while (written < totalSamples) {
      const slice = mixBuffer.slice(written, written + chunkSize);
      const dur = slice.length / sr;
      const sample = new AudioSample({
        data: slice,
        format: "f32-planar",
        numberOfChannels: 1,
        sampleRate: sr,
        timestamp: written / sr,
        duration: dur,
      });
      await audioSource.add(sample);
      sample.close();
      written += chunkSize;
    }

    await output.finalize();
    return new Blob([outputTarget.buffer], { type: "video/mp4" });
  }

  async _getDuration(blob) {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.src = URL.createObjectURL(blob);
      v.onloadedmetadata = () => {
        resolve(v.duration);
        URL.revokeObjectURL(v.src);
      };
      v.onerror = reject;
    });
  }
}