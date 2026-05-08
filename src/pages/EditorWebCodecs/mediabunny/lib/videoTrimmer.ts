// @ts-nocheck
import {
  Input,
  Output,
  BlobSource,
  StreamTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  ALL_FORMATS,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
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

const TEMP_FILE_PREFIX = "trim-";
const STALE_AGE_MS = 5 * 60 * 1000;

const sweepStaleTrimFiles = async () => {
  try {
    const dir = await navigator.storage.getDirectory();
    const now = Date.now();
    for await (const [name, handle] of (dir as any).entries()) {
      if (!name.startsWith(TEMP_FILE_PREFIX)) continue;
      try {
        const file = await handle.getFile();
        if (now - file.lastModified > STALE_AGE_MS) {
          await dir.removeEntry(name).catch(() => {});
        }
      } catch {}
    }
  } catch {}
};

export class VideoTrimmer {
  async trim(sourceBlob: Blob, options: TrimOptions): Promise<Blob> {
    const { startTime, endTime, outputFormat, onProgress } = options;

    if (startTime < 0) throw new Error("Start time cannot be negative");
    if (endTime <= startTime) throw new Error("End time must be greater than start time");

    await sweepStaleTrimFiles();

    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(sourceBlob),
    });

    const inputFormat = await input.getFormat();
    const targetFormat =
      outputFormat ||
      (inputFormat.name.toLowerCase().includes("mp4") ? "mp4" : "webm");

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("Trimming failed - no video track");
    const audioTrack = await input.getPrimaryAudioTrack().catch(() => null);

    // Stream-copy needs a keyframe at the cut; output is rebased to 0.
    const videoSink = new EncodedPacketSink(videoTrack);
    const startKey = await videoSink.getKeyPacket(startTime);
    if (!startKey) throw new Error("Trimming failed - no key packet at start");
    const baseTime = startKey.timestamp;
    const endVideoPacket = Number.isFinite(endTime)
      ? await videoSink.getPacket(endTime)
      : null;

    const dir = await navigator.storage.getDirectory();
    const outFileName = `${TEMP_FILE_PREFIX}${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${targetFormat}`;
    const outHandle = await dir.getFileHandle(outFileName, { create: true });
    const writable = await (outHandle as any).createWritable();

    const format: OutputFormat =
      targetFormat === "mp4"
        ? new Mp4OutputFormat({ fastStart: false })
        : new WebMOutputFormat();

    const target = new StreamTarget(writable, { chunked: true });
    const output = new Output({ format, target });

    const videoCodec = videoTrack.codec;
    const videoDecoderConfig = await videoTrack.getDecoderConfig();
    const videoSource = new EncodedVideoPacketSource(videoCodec);
    output.addVideoTrack(videoSource);

    let audioSource: any = null;
    let audioDecoderConfig: any = null;
    if (audioTrack) {
      try {
        audioDecoderConfig = await audioTrack.getDecoderConfig();
        audioSource = new EncodedAudioPacketSource(audioTrack.codec);
        output.addAudioTrack(audioSource);
      } catch {
        audioSource = null;
        audioDecoderConfig = null;
      }
    }

    await output.start();

    const totalSpan = Math.max(0.001, endTime - baseTime);

    const pipeVideo = async () => {
      let isFirst = true;
      const iter = endVideoPacket
        ? videoSink.packets(startKey, endVideoPacket)
        : videoSink.packets(startKey);
      for await (const packet of iter) {
        const rebased = packet.clone({ timestamp: packet.timestamp - baseTime });
        if (isFirst) {
          await videoSource.add(rebased, { decoderConfig: videoDecoderConfig });
          isFirst = false;
        } else {
          await videoSource.add(rebased);
        }
        if (onProgress) {
          const pct = Math.min(1, (packet.timestamp - baseTime) / totalSpan);
          onProgress(pct);
        }
      }
    };

    const pipeAudio = async () => {
      if (!audioSource || !audioTrack) return;
      const audioSink = new EncodedPacketSink(audioTrack);
      const startA = await audioSink.getPacket(baseTime);
      if (!startA) return;
      const endA = Number.isFinite(endTime)
        ? await audioSink.getPacket(endTime)
        : null;
      let isFirst = true;
      const iter = endA ? audioSink.packets(startA, endA) : audioSink.packets(startA);
      for await (const packet of iter) {
        // First audio packet may sit slightly before baseTime.
        const ts = Math.max(0, packet.timestamp - baseTime);
        const rebased = packet.clone({ timestamp: ts });
        if (isFirst) {
          await audioSource.add(rebased, { decoderConfig: audioDecoderConfig });
          isFirst = false;
        } else {
          await audioSource.add(rebased);
        }
      }
    };

    try {
      await Promise.all([pipeVideo(), pipeAudio()]);
      await output.finalize();
      // finalize() owns the writable lock; don't close here.
    } catch (err) {
      try { await writable.abort(); } catch {}
      try { await dir.removeEntry(outFileName); } catch {}
      throw err;
    }

    const file = await outHandle.getFile();
    // Read into ArrayBuffer so deleting the OPFS entry doesn't invalidate
    // the returned Blob (some impls back File lazily by the handle).
    const bytes = await file.arrayBuffer();
    try { await dir.removeEntry(outFileName); } catch {}
    return new Blob([bytes], {
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
