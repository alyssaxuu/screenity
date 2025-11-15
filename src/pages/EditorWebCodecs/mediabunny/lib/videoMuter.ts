// @ts-nocheck
import {
  Input,
  BlobSource,
  Output,
  BufferTarget,
  Mp4OutputFormat,
  VideoSampleSource,
  VideoSampleSink,
  AudioSampleSource,
  AudioSample,
  ALL_FORMATS,
  QUALITY_HIGH,
} from "mediabunny";

export class VideoMuter {
  async mute(
    videoBlob,
    {
      muteStart = 0,
      muteEnd = 0,
      videoVolume = 1.0,
      outputFormat = "mp4",
      onProgress,
    } = {}
  ) {
    const videoDuration = await this._getDuration(videoBlob);
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

    let decodedAudio = null;
    try {
      const buf = await videoBlob.arrayBuffer();
      const ctx = new AudioContext();
      decodedAudio = await ctx.decodeAudioData(buf);
    } catch {}

    const sr = decodedAudio?.sampleRate || 48000;
    const mixBuffer = new Float32Array(Math.ceil(sr * videoDuration));

    if (decodedAudio) {
      const channelData = decodedAudio.getChannelData(0);
      const muteStartSample = Math.floor(muteStart * sr);
      const muteEndSample = Math.floor(muteEnd * sr);

      for (let i = 0; i < channelData.length; i++) {
        mixBuffer[i] =
          i >= muteStartSample && i < muteEndSample ? 0 : channelData[i] * videoVolume;
      }
    } else {
      return videoBlob;
    }

    const audioSource = new AudioSampleSource({
      codec: "aac",
      bitrate: 128000,
    });
    output.addAudioTrack(audioSource);

    await output.start();
    for await (const frame of videoSink.samples(0, videoDuration)) {
      await videoSource.add(frame);
      frame.close();
      if (onProgress) onProgress(frame.timestamp / videoDuration);
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
    return new Blob([outputTarget.buffer], {
      type: outputFormat === "webm" ? "video/webm" : "video/mp4",
    });
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