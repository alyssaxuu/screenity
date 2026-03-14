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
import { videoConverter } from "./videoConverter";

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

    // Cap at 15 min to avoid OOM — re-encoding needs several copies in memory.
    if (videoDuration > 900) {
      throw new Error(
        `Video is too long for in-browser audio muting (${Math.round(videoDuration / 60)} min). ` +
          `Maximum supported length is 15 minutes.`
      );
    }

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
    const codecInfo = await videoConverter.detectBestCodec("mp4");
    const videoCodec = codecInfo?.codec ?? "avc";
    const videoSource = new VideoSampleSource({
      codec: videoCodec,
      bitrate: QUALITY_HIGH,
    });
    output.addVideoTrack(videoSource);

    let decodedAudio = null;
    const ctx = new AudioContext();
    try {
      let buf = await videoBlob.arrayBuffer();
      decodedAudio = await ctx.decodeAudioData(buf);
      buf = null; // release compressed bytes; PCM is now in decodedAudio
    } catch {
      // decode failed; mute returns original blob below
    } finally {
      ctx.close().catch(() => {});
    }

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
    // Always MP4 container — use correct MIME type.
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