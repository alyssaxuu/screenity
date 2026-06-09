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
import { videoConverter } from "./videoConverter";

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

    const codecInfo = await videoConverter.detectBestCodec("mp4");
    const videoCodec = codecInfo?.codec ?? "avc";
    const videoSource = new VideoSampleSource({
      codec: videoCodec,
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

    const debugLog = process.env.SCREENITY_DEV_MODE === "true";
    if (debugLog) {
      console.log("[cut-debug][cutter] start", {
        cutStart,
        cutEnd,
        total,
        sourceBlobSize: sourceBlob.size,
        sourceBlobType: sourceBlob.type,
        videoCodec,
        hasAudio: !!audioTrack,
      });
    }

    const addSegment = async (start: number, end: number, segIdx: number) => {
      const segDur = end - start;
      const baseTimestamp = outPts / 1_000_000;
      let videoSampleCount = 0;
      let audioSampleCount = 0;
      let firstVideoTs: number | null = null;
      let lastVideoTs: number | null = null;
      let firstAudioTs: number | null = null;
      let lastAudioTs: number | null = null;

      const videoSink = new VideoSampleSink(videoTrack);
      for await (const sample of videoSink.samples(start, end)) {
        if (firstVideoTs === null) firstVideoTs = sample.timestamp;
        lastVideoTs = sample.timestamp;
        videoSampleCount += 1;
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
          if (firstAudioTs === null) firstAudioTs = sample.timestamp;
          lastAudioTs = sample.timestamp;
          audioSampleCount += 1;
          const adjusted = Math.max(0, baseTimestamp + (sample.timestamp - start));
          sample.setTimestamp(adjusted);
          await audioSource.add(sample);
          sample.close();
          processedTime += sample.duration ?? 0;
          if (onProgress) onProgress(processedTime / total);
        }
      }

      if (debugLog) {
        console.log(`[cut-debug][cutter] segment ${segIdx} done`, {
          requestedRange: [start, end],
          segDur,
          baseTimestamp,
          videoSampleCount,
          audioSampleCount,
          firstVideoTs,
          lastVideoTs,
          firstAudioTs,
          lastAudioTs,
          outPtsAfter: outPts + segDur * 1_000_000,
        });
      }

      outPts += segDur * 1_000_000;
    };

    for (let i = 0; i < totalSegments.length; i++) {
      const [start, end] = totalSegments[i];
      await addSegment(start, end, i);
    }

    await output.finalize();

    const blob = new Blob([outputTarget.buffer], { type: "video/mp4" });
    if (debugLog) {
      console.log("[cut-debug][cutter] finalize complete", {
        outputBlobSize: blob.size,
        expectedDuration: total - (cutEnd - cutStart),
      });
    }
    if (onProgress) onProgress(1);
    return blob;
  }

  getDuration(blob) {
    return new Promise((res, rej) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(blob);
      v.src = url;
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        res(v.duration);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        rej(new Error("Failed to load video"));
      };
    });
  }
}