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
  type VideoCodec,
  type AudioCodec,
} from "mediabunny";

export type SupportedFormat = "mp4" | "webm";

export interface ConversionOptions {
  videoBitrate?: number;
  audioBitrate?: number;
  preferredVideoCodec?: VideoCodec;
  audioCodec?: AudioCodec;
  onProgress?: (progress: number) => void;
  // Called if the conversion discarded the source's audio track (e.g. mediabunny
  // can't decode it in this browser). The output has no audio; the caller should
  // fall back rather than ship a silent file.
  onAudioDropped?: () => void;
  verbose?: boolean;
  // When provided (e.g. a StreamTarget writing to OPFS), output streams to it
  // and convert() resolves to null; the caller owns the written file. Used by
  // the offscreen worker to re-encode large files with bounded memory.
  target?: any;
}

export interface CodecInfo {
  codec: VideoCodec;
  displayName: string;
  isPreferred: boolean;
}

const CODEC_DISPLAY_NAMES: Record<VideoCodec, string> = {
  avc: "H.264",
  hevc: "H.265 (HEVC)",
  vp9: "VP9",
  av1: "AV1",
  vp8: "VP8",
};

export class VideoConverter {
  private cachedMP4Codec: VideoCodec | null = null;
  private cachedWebMCodec: VideoCodec | null = null;

  async convertToMP4(
    sourceBlob: Blob,
    options: ConversionOptions = {}
  ): Promise<Blob> {
    return this.convert(sourceBlob, "mp4", options);
  }

  async convertToWebM(
    sourceBlob: Blob,
    options: ConversionOptions = {}
  ): Promise<Blob> {
    return this.convert(sourceBlob, "webm", options);
  }

  async detectBestCodec(format: SupportedFormat): Promise<CodecInfo | null> {
    const outputFormat =
      format === "mp4"
        ? new Mp4OutputFormat({ fastStart: false })
        : new WebMOutputFormat();
    const supportedCodecs = outputFormat.getSupportedVideoCodecs();

    for (const codec of supportedCodecs) {
      if (await this.canEncodeCodec(codec)) {
        return {
          codec,
          displayName:
            CODEC_DISPLAY_NAMES[codec as keyof typeof CODEC_DISPLAY_NAMES] ||
            codec.toUpperCase(),
          isPreferred: codec === "avc" || codec === "vp9",
        };
      }
    }
    return null;
  }

  async canEncodeCodec(codec: VideoCodec): Promise<boolean> {
    if (typeof VideoEncoder === "undefined") return false;
    try {
      const testConfig = this.getEncoderConfig(codec);
      const support = await VideoEncoder.isConfigSupported(testConfig);
      return support.supported ?? false;
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.cachedMP4Codec = null;
    this.cachedWebMCodec = null;
  }

  private async convert(
    sourceBlob: Blob,
    targetFormat: SupportedFormat,
    options: ConversionOptions
  ): Promise<Blob> {
    const {
      videoBitrate = 5_000_000,
      audioBitrate = 128_000,
      preferredVideoCodec,
      audioCodec,
      onProgress,
      onAudioDropped,
    } = options;

    const cache =
      targetFormat === "mp4" ? this.cachedMP4Codec : this.cachedWebMCodec;
    let videoCodec: VideoCodec | null = cache;

    if (!videoCodec) {
      if (
        preferredVideoCodec &&
        (await this.canEncodeCodec(preferredVideoCodec))
      ) {
        videoCodec = preferredVideoCodec;
      } else {
        const codecInfo = await this.detectBestCodec(targetFormat);
        if (!codecInfo) {
          throw new Error(
            `Cannot convert to ${targetFormat.toUpperCase()}: no supported video codec.`
          );
        }
        videoCodec = codecInfo.codec;
      }
      if (targetFormat === "mp4") this.cachedMP4Codec = videoCodec;
      else this.cachedWebMCodec = videoCodec;
    }

    const finalAudioCodec =
      audioCodec || (targetFormat === "mp4" ? "aac" : "opus");

    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(sourceBlob),
    });

    const outputFormat =
      targetFormat === "mp4"
        ? new Mp4OutputFormat({ fastStart: false })
        : new WebMOutputFormat();

    const target = options.target || new BufferTarget();
    const output = new Output({ format: outputFormat, target });

    const conversion = await Conversion.init({
      input,
      output,
      video: { codec: videoCodec, bitrate: videoBitrate },
      audio: { codec: finalAudioCodec, bitrate: audioBitrate },
    });

    // mediabunny can validate a conversion while silently discarding an audio
    // track. On Linux Chromium the source Opus decodes fine, but the browser
    // has no AAC encoder, so MP4 audio (which must be AAC) can't be re-encoded
    // and mediabunny drops it with reason `no_encodable_target_codec`. Surface
    // that so callers never ship a video-only file.
    const droppedAudio = conversion.discardedTracks.filter(
      (t) => t.track.type === "audio"
    );
    if (droppedAudio.length > 0) {
      if (onAudioDropped) onAudioDropped();
      // Log the concrete discard reason + codec as a plain string. mediabunny's
      // own warning only prints "[object Object]", hiding WHY
      // (undecodable_source_codec vs no_encodable_target_codec) — two different
      // root causes that need different fixes. Console DevTools collapses an
      // object arg into "[object Object]", so serialize it into the message.
      for (const t of droppedAudio) {
        const codec =
          t.track.codec ?? (await t.track.getCodec().catch(() => null));
        console.warn(
          `[screenity-transcode] audio track discarded | reason=${
            t.reason
          } | codec=${String(codec)}`
        );
      }
    }

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks
        .map((t) => `${t.track.type}: ${t.reason}`)
        .join(", ");
      throw new Error(`Conversion failed - ${reasons}`);
    }

    if (onProgress) conversion.onProgress = onProgress;

    await conversion.execute();

    // Streamed to a caller-provided target (e.g. OPFS): the caller owns the
    // output file, so there's no in-memory buffer to wrap.
    if (options.target) return null;

    if (!target.buffer) throw new Error("Conversion failed - no output buffer");

    return new Blob([target.buffer], {
      type: targetFormat === "mp4" ? "video/mp4" : "video/webm",
    });
  }

  private getEncoderConfig(codec: VideoCodec): VideoEncoderConfig {
    const baseConfig = { width: 1920, height: 1080, bitrate: 5_000_000 };
    switch (codec) {
      case "avc":
        return { ...baseConfig, codec: "avc1.42E01E" };
      case "hevc":
        return { ...baseConfig, codec: "hev1.1.6.L93.B0" };
      default:
        return { ...baseConfig, codec };
    }
  }
}

export const videoConverter = new VideoConverter();

export async function convertToMP4(
  blob: Blob,
  options?: ConversionOptions
): Promise<Blob> {
  return videoConverter.convertToMP4(blob, options);
}

export async function convertToWebM(
  blob: Blob,
  options?: ConversionOptions
): Promise<Blob> {
  return videoConverter.convertToWebM(blob, options);
}
