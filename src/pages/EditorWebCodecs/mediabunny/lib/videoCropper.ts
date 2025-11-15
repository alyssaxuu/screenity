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

export interface CropOptions {
  left: number;
  top: number;
  width: number;
  height: number;
  outputFormat?: "mp4" | "webm";
  videoBitrate?: number;
  audioBitrate?: number;
  onProgress?: (progress: number) => void;
  verbose?: boolean;
}

export interface CropInfo {
  originalWidth: number;
  originalHeight: number;
  croppedWidth: number;
  croppedHeight: number;
  cropRegion: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export class VideoCropper {
  async crop(sourceBlob: Blob, options: CropOptions): Promise<Blob> {
    const {
      left,
      top,
      width,
      height,
      outputFormat,
      videoBitrate,
      audioBitrate,
      onProgress,
    } = options;

    if (left < 0 || top < 0) throw new Error("Crop position cannot be negative");
    if (width <= 0 || height <= 0) throw new Error("Crop dimensions must be positive");

    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(sourceBlob),
    });

    const inputFormat = await input.getFormat();
    const tracks = await input.getTracks();
    const videoTrack = tracks.find((t) => t.type === "video");

    if (!videoTrack || !videoTrack.isVideoTrack()) throw new Error("No video track found in input");

    const originalWidth = videoTrack.displayWidth;
    const originalHeight = videoTrack.displayHeight;

    if (left + width > originalWidth || top + height > originalHeight) {
      const clampedWidth = Math.min(width, originalWidth - left);
      const clampedHeight = Math.min(height, originalHeight - top);
      options.width = clampedWidth;
      options.height = clampedHeight;
    }

    let format: OutputFormat;
    const targetFormat =
      outputFormat ||
      (inputFormat.name.toLowerCase().includes("mp4") ? "mp4" : "webm");

    format =
      targetFormat === "mp4"
        ? new Mp4OutputFormat({ fastStart: "in-memory" })
        : new WebMOutputFormat();

    const target = new BufferTarget();
    const output = new Output({ format, target });

    const conversion = await Conversion.init({
      input,
      output,
      video: {
        crop: { left, top, width, height },
        ...(videoBitrate && { bitrate: videoBitrate }),
      },
      ...(audioBitrate && { audio: { bitrate: audioBitrate } }),
    });

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks
        .map((t) => `${t.track.type}: ${t.reason}`)
        .join(", ");
      throw new Error(`Cropping failed - ${reasons}`);
    }

    if (onProgress) conversion.onProgress = onProgress;

    await conversion.execute();

    if (!target.buffer) throw new Error("Cropping failed - no output buffer");

    return new Blob([target.buffer], {
      type: targetFormat === "mp4" ? "video/mp4" : "video/webm",
    });
  }

  async getDimensions(blob: Blob): Promise<{
    width: number;
    height: number;
    codedWidth: number;
    codedHeight: number;
  }> {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(blob),
    });

    const tracks = await input.getTracks();
    const videoTrack = tracks.find((t) => t.type === "video");

    if (!videoTrack || !videoTrack.isVideoTrack()) throw new Error("No video track found");

    return {
      width: videoTrack.displayWidth,
      height: videoTrack.displayHeight,
      codedWidth: videoTrack.codedWidth,
      codedHeight: videoTrack.codedHeight,
    };
  }
}

export const videoCropper = new VideoCropper();

export async function cropVideo(
  blob: Blob,
  left: number,
  top: number,
  width: number,
  height: number,
  options?: Omit<CropOptions, "left" | "top" | "width" | "height">
): Promise<Blob> {
  return videoCropper.crop(blob, { left, top, width, height, ...options });
}