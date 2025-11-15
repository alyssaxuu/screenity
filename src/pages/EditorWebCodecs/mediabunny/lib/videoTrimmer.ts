// @ts-nocheck
import {
  Input,
  Output,
  BlobSource,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  ALL_FORMATS,
  Conversion,
  type OutputFormat,
} from "mediabunny";

export interface TrimOptions {
  startTime: number;
  endTime: number;
  outputFormat?: "mp4" | "webm";
  videoBitrate?: number;
  audioBitrate?: number;
  onProgress?: (progress: number) => void;
}

export interface TrimInfo {
  originalDuration: number;
  trimmedDuration: number;
  startTime: number;
  endTime: number;
  format: string;
}

export class VideoTrimmer {
  async trim(sourceBlob: Blob, options: TrimOptions): Promise<Blob> {
    const { startTime, endTime, outputFormat, videoBitrate, audioBitrate, onProgress } = options;

    if (startTime < 0) throw new Error("Start time cannot be negative");
    if (endTime <= startTime) throw new Error("End time must be greater than start time");

    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(sourceBlob),
    });

    const inputFormat = await input.getFormat();
    const targetFormat =
      outputFormat ||
      (inputFormat.name.toLowerCase().includes("mp4") ? "mp4" : "webm");

    const format: OutputFormat =
      targetFormat === "mp4"
        ? new Mp4OutputFormat({ fastStart: "in-memory" })
        : new WebMOutputFormat();

    const target = new BufferTarget();
    const output = new Output({ format, target });

    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: startTime, end: endTime },
      ...(videoBitrate && { video: { bitrate: videoBitrate } }),
      ...(audioBitrate && { audio: { bitrate: audioBitrate } }),
    });

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks
        .map((t) => `${t.track.type}: ${t.reason}`)
        .join(", ");
      throw new Error(`Trimming failed - ${reasons}`);
    }

    if (onProgress) conversion.onProgress = onProgress;

    await conversion.execute();

    if (!target.buffer) throw new Error("Trimming failed - no output buffer");

    return new Blob([target.buffer], {
      type: targetFormat === "mp4" ? "video/mp4" : "video/webm",
    });
  }

  async getInfo(blob: Blob): Promise<{
    format: string;
    hasVideo: boolean;
    hasAudio: boolean;
    videoCodec?: string | null;
    audioCodec?: string | null;
    codedWidth?: number;
    codedHeight?: number;
  }> {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(blob),
    });

    const format = await input.getFormat();
    const tracks = await input.getTracks();
    const videoTrack = tracks.find((t) => t.type === "video");
    const audioTrack = tracks.find((t) => t.type === "audio");

    return {
      format: format.name,
      hasVideo: !!videoTrack,
      hasAudio: !!audioTrack,
      videoCodec: videoTrack?.codec || null,
      audioCodec: audioTrack?.codec || null,
      ...(videoTrack?.isVideoTrack() && {
        codedWidth: videoTrack.codedWidth,
        codedHeight: videoTrack.codedHeight,
      }),
    };
  }
}

export const videoTrimmer = new VideoTrimmer();

export async function trimVideo(
  blob: Blob,
  startTime: number,
  endTime: number,
  options?: Omit<TrimOptions, "startTime" | "endTime">
): Promise<Blob> {
  return videoTrimmer.trim(blob, { startTime, endTime, ...options });
}