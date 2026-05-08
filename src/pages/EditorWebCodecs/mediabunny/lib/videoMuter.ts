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
  AudioSampleSink,
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

    const audioTrack = await input.getPrimaryAudioTrack();
    const audioDecodable = audioTrack
      ? await audioTrack.canDecode().catch(() => false)
      : false;
    let audioSink = null;
    let audioSource = null;
    if (audioTrack && audioDecodable) {
      audioSink = new AudioSampleSink(audioTrack);
      audioSource = new AudioSampleSource({
        codec: "aac",
        bitrate: 128000,
      });
      output.addAudioTrack(audioSource);
    }

    await output.start();

    for await (const frame of videoSink.samples(0, videoDuration)) {
      await videoSource.add(frame);
      frame.close();
      if (onProgress) onProgress(frame.timestamp / videoDuration);
    }

    if (audioSink && audioSource) {
      for await (const sample of audioSink.samples()) {
        const s = sample.timestamp;
        const e = s + sample.duration;
        const fullyOutside = e <= muteStart || s >= muteEnd;

        if (fullyOutside && videoVolume === 1) {
          await audioSource.add(sample);
          sample.close();
          continue;
        }

        const numChannels = sample.numberOfChannels;
        const sr = sample.sampleRate;
        const frameCount = sample.numberOfFrames;
        const data = new Float32Array(frameCount * numChannels);
        for (let ch = 0; ch < numChannels; ch++) {
          const view = data.subarray(ch * frameCount, (ch + 1) * frameCount);
          sample.copyTo(view, { format: "f32-planar", planeIndex: ch });
        }

        for (let f = 0; f < frameCount; f++) {
          const t = s + f / sr;
          const gain = t >= muteStart && t < muteEnd ? 0 : videoVolume;
          if (gain !== 1) {
            for (let ch = 0; ch < numChannels; ch++) {
              data[ch * frameCount + f] *= gain;
            }
          }
        }

        const out = new AudioSample({
          data,
          format: "f32-planar",
          numberOfChannels: numChannels,
          sampleRate: sr,
          timestamp: s,
          duration: frameCount / sr,
        });
        await audioSource.add(out);
        out.close();
        sample.close();
      }
    }

    await output.finalize();
    return new Blob([outputTarget.buffer], { type: "video/mp4" });
  }

  async _getDuration(blob) {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(blob);
      v.src = url;
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(v.duration);
      };
      v.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
    });
  }
}