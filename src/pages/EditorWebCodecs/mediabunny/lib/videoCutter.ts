// @ts-nocheck
import {
  Input,
  BlobSource,
  ALL_FORMATS,
  Output,
  BufferTarget,
  Mp4OutputFormat,
  QUALITY_HIGH,
  VideoSampleSource,
  AudioSampleSource,
  VideoSampleSink,
  AudioSampleSink,
} from "mediabunny";

export class VideoCutter {
  async cut(sourceBlob, { cutStart, cutEnd, onProgress }) {
    const total = await this.getDuration(sourceBlob);

    const input = new Input({
      source: new BlobSource(sourceBlob),
      formats: ALL_FORMATS,
    });

    const outputTarget = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: outputTarget,
    });

    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack().catch(() => null);

    const videoSource = new VideoSampleSource({
      codec: "avc",
      bitrate: QUALITY_HIGH,
      sizeChangeBehavior: "passThrough",
    });
    output.addVideoTrack(videoSource);

    let audioSource = null;
    if (audioTrack) {
      audioSource = new AudioSampleSource({
        codec: "aac",
        bitrate: QUALITY_HIGH,
      });
      output.addAudioTrack(audioSource);
    }

    await output.start();

    let outPts = 0;
    const totalSegments = [
      [0, cutStart],
      [cutEnd, total],
    ];
    let processedTime = 0;

    const addSegment = async (start, end) => {
      const segDur = end - start;
      const baseTimestamp = outPts / 1_000_000;

      const videoSink = new VideoSampleSink(videoTrack);
      for await (const sample of videoSink.samples(start, end)) {
        const adjusted = Math.max(0, baseTimestamp + (sample.timestamp - start));
        sample.setTimestamp(adjusted);
        await videoSource.add(sample);
        sample.close();
        processedTime += sample.duration ?? 1 / 30;
        if (onProgress) onProgress(processedTime / total);
      }

      if (audioTrack && audioSource) {
        const audioSink = new AudioSampleSink(audioTrack);
        for await (const sample of audioSink.samples(start, end)) {
          const adjusted = Math.max(0, baseTimestamp + (sample.timestamp - start));
          sample.setTimestamp(adjusted);
          await audioSource.add(sample);
          sample.close();
          processedTime += sample.duration ?? 0;
          if (onProgress) onProgress(processedTime / total);
        }
      }

      outPts += segDur * 1_000_000;
    };

    for (let i = 0; i < totalSegments.length; i++) {
      const [start, end] = totalSegments[i];
      await addSegment(start, end);
    }

    await output.finalize();

    const blob = new Blob([outputTarget.buffer], { type: "video/mp4" });
    if (onProgress) onProgress(1);
    return blob;
  }

  getDuration(blob) {
    return new Promise((res, rej) => {
      const v = document.createElement("video");
      v.src = URL.createObjectURL(blob);
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(v.src);
        res(v.duration);
      };
      v.onerror = () => rej(new Error("Failed to load video"));
    });
  }
}