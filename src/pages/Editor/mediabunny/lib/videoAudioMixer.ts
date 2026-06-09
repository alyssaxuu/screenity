// @ts-nocheck
import {
  Input,
  BlobSource,
  Output,
  BufferTarget,
  Mp4OutputFormat,
  VideoSampleSource,
  AudioSampleSource,
  AudioSampleSink,
  VideoSampleSink,
  AudioSample,
  ALL_FORMATS,
  QUALITY_HIGH,
} from "mediabunny";
import { videoConverter } from "./videoConverter";

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
    const codecInfo = await videoConverter.detectBestCodec("mp4");
    const videoCodec = codecInfo?.codec ?? "avc";
    const videoSource = new VideoSampleSource({
      codec: videoCodec,
      bitrate: QUALITY_HIGH,
    });
    output.addVideoTrack(videoSource);

    const videoDuration = await this._getDuration(videoBlob);

    const videoAudioTrack = await input.getPrimaryAudioTrack().catch(() => null);
    const hasVideoAudio =
      !!videoAudioTrack && (await videoAudioTrack.canDecode().catch(() => false));

    const audioSource = new AudioSampleSource({
      codec: "aac",
      bitrate: 128000,
    });
    output.addAudioTrack(audioSource);

    if (audioBlob.size > 50_000_000) {
      throw new Error("background-audio-too-large");
    }
    let bgArrayBuffer = await audioBlob.arrayBuffer();
    const audioCtx = new AudioContext();
    let decodedAudio;
    try {
      decodedAudio = await audioCtx.decodeAudioData(bgArrayBuffer);
      bgArrayBuffer = null;
    } finally {
      audioCtx.close().catch(() => {});
    }
    const bgSr = decodedAudio.sampleRate;
    const bgDur = decodedAudio.duration;
    const bgData = decodedAudio.getChannelData(0);
    const bgLen = bgData.length;

    const bgSampleAt = (tSec) => {
      // Zero-duration BG would NaN through the modulo below.
      if (!(bgDur > 0)) return 0;
      let t = tSec;
      if (loop) {
        t = ((t % bgDur) + bgDur) % bgDur;
      } else if (t < 0 || t >= bgDur) {
        return 0;
      }
      const idx = t * bgSr;
      const i0 = Math.floor(idx);
      if (i0 < 0 || i0 >= bgLen) return 0;
      const frac = idx - i0;
      const s0 = bgData[i0];
      const s1 = i0 + 1 < bgLen ? bgData[i0 + 1] : s0;
      return s0 + (s1 - s0) * frac;
    };

    await output.start();

    for await (const frame of videoSink.samples(0, videoDuration)) {
      await videoSource.add(frame);
      frame.close();
      if (onProgress && videoDuration > 0)
        onProgress((frame.timestamp / videoDuration) * 0.8);
    }

    if (hasVideoAudio && mode === "mix") {
      const audioSink = new AudioSampleSink(videoAudioTrack);
      let lastSr = bgSr;
      let lastNumCh = 1;
      let lastEnd = 0;
      for await (const sample of audioSink.samples()) {
        const numCh = sample.numberOfChannels;
        const sr = sample.sampleRate;
        const N = sample.numberOfFrames;
        const ts = sample.timestamp;
        lastSr = sr;
        lastNumCh = numCh;

        const mixed = new Float32Array(N * numCh);
        for (let ch = 0; ch < numCh; ch++) {
          const plane = mixed.subarray(ch * N, (ch + 1) * N);
          sample.copyTo(plane, { format: "f32-planar", planeIndex: ch });
        }
        for (let ch = 0; ch < numCh; ch++) {
          const offset = ch * N;
          for (let f = 0; f < N; f++) {
            const t = ts + f / sr;
            mixed[offset + f] =
              mixed[offset + f] * videoVolume + bgSampleAt(t) * audioVolume;
          }
        }

        const out = new AudioSample({
          data: mixed,
          format: "f32-planar",
          numberOfChannels: numCh,
          sampleRate: sr,
          timestamp: ts,
          duration: N / sr,
        });
        await audioSource.add(out);
        out.close();
        sample.close();
        lastEnd = ts + N / sr;
        if (onProgress && videoDuration > 0)
          onProgress(0.8 + Math.min(1, ts / videoDuration) * 0.2);
      }

      // Source audio shorter than video: fill remainder with BG only.
      if (lastEnd < videoDuration - 0.01) {
        const sr = lastSr;
        const numCh = lastNumCh;
        const totalFrames = Math.floor((videoDuration - lastEnd) * sr);
        const chunkFrames = sr * 2;
        let frame = 0;
        while (frame < totalFrames) {
          const n = Math.min(chunkFrames, totalFrames - frame);
          const chunk = new Float32Array(n * numCh);
          for (let ch = 0; ch < numCh; ch++) {
            const offset = ch * n;
            for (let f = 0; f < n; f++) {
              const t = lastEnd + (frame + f) / sr;
              chunk[offset + f] = bgSampleAt(t) * audioVolume;
            }
          }
          const out = new AudioSample({
            data: chunk,
            format: "f32-planar",
            numberOfChannels: numCh,
            sampleRate: sr,
            timestamp: lastEnd + frame / sr,
            duration: n / sr,
          });
          await audioSource.add(out);
          out.close();
          frame += n;
        }
      }
    } else {
      const sr = bgSr;
      const totalFrames = Math.floor(videoDuration * sr);
      const chunkFrames = sr * 2;
      let frame = 0;
      while (frame < totalFrames) {
        const n = Math.min(chunkFrames, totalFrames - frame);
        const chunk = new Float32Array(n);
        for (let f = 0; f < n; f++) {
          const t = (frame + f) / sr;
          chunk[f] = bgSampleAt(t) * audioVolume;
        }
        const out = new AudioSample({
          data: chunk,
          format: "f32-planar",
          numberOfChannels: 1,
          sampleRate: sr,
          timestamp: frame / sr,
          duration: n / sr,
        });
        await audioSource.add(out);
        out.close();
        frame += n;
        if (onProgress && totalFrames > 0)
          onProgress(0.8 + (frame / totalFrames) * 0.2);
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