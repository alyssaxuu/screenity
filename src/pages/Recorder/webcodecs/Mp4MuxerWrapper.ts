/*!
 * Screenity WebCodecs Recorder - MP4 Muxer Wrapper
 * Licensed under the GNU GPLv3.
 */
// @ts-nocheck

import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacket,
} from "mediabunny";

interface Mp4MuxerWrapperOptions {
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
  videoCodec?: string;
  audioCodec?: string;
  onChunk: (chunk: Uint8Array, timestampUs: number | null) => void | Promise<void>;
  debug?: boolean;
}

export class Mp4MuxerWrapper {
  private output: Output;
  private target: BufferTarget;

  private videoSource: EncodedVideoPacketSource;
  private audioSource: EncodedAudioPacketSource | null = null;

  private videoCodec: string;
  private audioCodec: string;
  private pausedOffsetUs = 0;
  private started = false;

  private videoTimestampOffsetUs: number | null = null;
  private audioTimestampOffsetUs: number | null = null;
  private lastVideoTimestampUs = 0;
  private lastAudioTimestampUs = 0;

  private _lastDecoderConfig: any = null;

  private debug: boolean;
  private log: (...args: any[]) => void;
  private warn: (...args: any[]) => void;
  private err: (...args: any[]) => void;

  constructor(private options: Mp4MuxerWrapperOptions) {
    this.debug = options.debug ?? false;

    this.log = (...args) => this.debug && console.log(...args);
    this.warn = (...args) => this.debug && console.warn(...args);
    this.err = (...args) => this.debug && console.error(...args);

    this.videoCodec = options.videoCodec || "avc";
    this.audioCodec = options.audioCodec || "aac";

    this.target = new BufferTarget();
    this.output = new Output({
      format: new Mp4OutputFormat({
        fastStart: false, // metadata at end, more compatible
      }),
      target: this.target,
    });

    this.videoSource = new EncodedVideoPacketSource(this.videoCodec);
    this.output.addVideoTrack(this.videoSource, {
      frameRate: this.options.fps,
    });
  }

  enableAudio() {
    if (!this.audioSource) {
      this.log("[MUXER] enableAudio");
      this.audioSource = new EncodedAudioPacketSource(this.audioCodec);
      this.output.addAudioTrack(this.audioSource);
    }
  }

  addVideoChunk(chunk: EncodedVideoChunk, meta: any) {
    if (meta?.decoderConfig) {
      this._lastDecoderConfig = meta.decoderConfig;
    } else if (!meta.decoderConfig && this._lastDecoderConfig) {
      meta.decoderConfig = this._lastDecoderConfig;
    }

    const packet = this.buildPacket(chunk, meta, "video");
    return this.videoSource.add(packet, meta);
  }

  addAudioChunk(chunk: EncodedAudioChunk, meta: any) {
    if (!this.audioSource) return;

    const packet = this.buildPacket(chunk, meta, "audio");
    return this.audioSource.add(packet, meta);
  }

  async start() {
    if (this.started) return;
    this.log("[MUXER] start");
    await this.output.start();
    this.started = true;
  }

  async finalize() {
    this.log("[MUXER] finalize");
    await this.output.finalize();

    const data = this.target.buffer;
    if (data?.byteLength) {
      this.log("[MUXER] emitting final file", data.byteLength, "bytes");
      this.emitChunk(new Uint8Array(data), null);
    }
  }

  setPausedOffset(offsetUs: number) {
    this.pausedOffsetUs = offsetUs;
  }

  setAudioOffset(offsetUs: number) {
    this.audioTimestampOffsetUs = offsetUs;
  }

  private emitChunk(chunk: Uint8Array, timestampUs: number | null) {
    try {
      const res = this.options.onChunk?.(chunk, timestampUs ?? null);
      if (res instanceof Promise) {
        res.catch((err) => this.err("[MUXER] onChunk rejected", err));
      }
    } catch (err) {
      this.err("[MUXER] onChunk error", err);
    }
  }

  private buildPacket(
    chunk: EncodedVideoChunk | EncodedAudioChunk,
    meta: any,
    type: "video" | "audio"
  ) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    const tsUs = this.normalizeTimestamp(type, chunk.timestamp, chunk.duration || 0);
    const durSec = (chunk.duration || 0) / 1e6;

    return new EncodedPacket(data, chunk.type, tsUs / 1e6, durSec);
  }

  private normalizeTimestamp(
    type: "video" | "audio",
    timestampUs?: number,
    durationUs = 0
  ) {
    const key = type === "video" ? "lastVideoTimestampUs" : "lastAudioTimestampUs";
    const last = (this as any)[key] ?? 0;

    if (type === "audio") {
      const next = last + durationUs;
      (this as any)[key] = next;
      this.log(`[MUX] audio ts +${durationUs} => ${next}`);
      return next;
    }

    if (typeof timestampUs !== "number") {
      const fallback = last + durationUs;
      (this as any)[key] = fallback;
      this.warn("[MUX] video missing ts, fallback:", fallback);
      return fallback;
    }

    if (this.videoTimestampOffsetUs == null) {
      this.videoTimestampOffsetUs = timestampUs;
    }

    const relative = Math.max(
      0,
      timestampUs - this.videoTimestampOffsetUs - this.pausedOffsetUs
    );

    (this as any)[key] = relative;
    this.log(`[MUX] video ts => ${relative}`);

    return relative;
  }
}