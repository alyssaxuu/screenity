/*!
 * Screenity WebCodecs Recorder - WebM/Matroska Muxer Wrapper
 * Licensed under the GNU GPLv3.
 */
// @ts-nocheck

import {
  Output,
  WebMOutputFormat,
  StreamTarget,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacket,
} from "mediabunny";

interface MkvMuxerWrapperOptions {
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

const FLUSH_BYTES = 1 * 1024 * 1024;
const FLUSH_INTERVAL_MS = 1000;

export class MkvMuxerWrapper {
  private output: Output;
  private target: StreamTarget;

  private videoSource: EncodedVideoPacketSource;
  private audioSource: EncodedAudioPacketSource | null = null;

  private videoCodec: string;
  private audioCodec: string;
  private started = false;

  private videoTimestampOffsetUs: number | null = null;
  private audioTimestampOffsetUs: number | null = null;
  private lastVideoTimestampUs = 0;
  private lastAudioTimestampUs = 0;

  private _lastDecoderConfig: any = null;

  private _writeBuffer: Uint8Array[] = [];
  private _writeBufferBytes = 0;
  private _writeBufferTimer: any = null;
  private _pendingFlush: Promise<void> = Promise.resolve();
  private _closed = false;

  private debug: boolean;
  private log: (...args: any[]) => void;
  private warn: (...args: any[]) => void;
  private err: (...args: any[]) => void;

  constructor(private options: MkvMuxerWrapperOptions) {
    this.debug = options.debug ?? false;

    this.log = (...args) => this.debug && console.log(...args);
    this.warn = (...args) => this.debug && console.warn(...args);
    this.err = (...args) => this.debug && console.error(...args);

    this.videoCodec = options.videoCodec || "vp9";
    this.audioCodec = options.audioCodec || "opus";

    // appendOnly so chunks on disk stay playable if finalize() never runs.
    const writable = new WritableStream<{ data: Uint8Array; position: number; type: string }>({
      write: (chunk) => {
        this.bufferWrite(chunk.data);
      },
    });
    this.target = new StreamTarget(writable);
    this.output = new Output({
      format: new WebMOutputFormat({
        appendOnly: true,
        minimumClusterDuration: 1,
      }),
      target: this.target,
    });

    this.videoSource = new EncodedVideoPacketSource(this.videoCodec);
    this.output.addVideoTrack(this.videoSource, {
      frameRate: this.options.fps,
    });
  }

  private bufferWrite(data: Uint8Array) {
    if (this._closed) return;
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    this._writeBuffer.push(copy);
    this._writeBufferBytes += copy.byteLength;

    if (this._writeBufferBytes >= FLUSH_BYTES) {
      this.flushWriteBuffer();
    } else if (!this._writeBufferTimer) {
      this._writeBufferTimer = setTimeout(
        () => this.flushWriteBuffer(),
        FLUSH_INTERVAL_MS,
      );
    }
  }

  private flushWriteBuffer() {
    if (this._writeBufferTimer) {
      clearTimeout(this._writeBufferTimer);
      this._writeBufferTimer = null;
    }
    if (this._writeBuffer.length === 0) return;

    const parts = this._writeBuffer;
    const total = this._writeBufferBytes;
    this._writeBuffer = [];
    this._writeBufferBytes = 0;

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      merged.set(p, offset);
      offset += p.byteLength;
    }

    this._pendingFlush = this._pendingFlush
      .catch(() => {})
      .then(() => this.emitChunk(merged, null));
  }

  enableAudio() {
    if (!this.audioSource) {
      this.log("[MKV-MUXER] enableAudio");
      this.audioSource = new EncodedAudioPacketSource(this.audioCodec);
      this.output.addAudioTrack(this.audioSource);
    }
  }

  addVideoChunk(chunk: EncodedVideoChunk, meta: any) {
    if (meta?.decoderConfig) {
      this._lastDecoderConfig = meta.decoderConfig;
    }

    const effectiveMeta =
      !meta?.decoderConfig && this._lastDecoderConfig
        ? { ...meta, decoderConfig: this._lastDecoderConfig }
        : meta;

    const packet = this.buildPacket(chunk, effectiveMeta, "video");
    return this.videoSource.add(packet, effectiveMeta);
  }

  addAudioChunk(chunk: EncodedAudioChunk, meta: any) {
    if (!this.audioSource) return;

    const packet = this.buildPacket(chunk, meta, "audio");
    return this.audioSource.add(packet, meta);
  }

  async start() {
    if (this.started) return;
    this.log("[MKV-MUXER] start");
    await this.output.start();
    this.started = true;
  }

  async finalize() {
    this.log("[MKV-MUXER] finalize");
    try {
      await this.output.finalize();
    } finally {
      this.flushWriteBuffer();
      this._closed = true;
      await this._pendingFlush;
    }
  }

  async flushPending() {
    this.flushWriteBuffer();
    this._closed = true;
    await this._pendingFlush;
  }

  setPausedOffset(_offsetUs: number) {}

  setAudioOffset(offsetUs: number) {
    this.audioTimestampOffsetUs = offsetUs;
  }

  private emitChunk(chunk: Uint8Array, timestampUs: number | null) {
    try {
      const res = this.options.onChunk?.(chunk, timestampUs ?? null);
      if (res instanceof Promise) {
        res.catch((err) => this.err("[MKV-MUXER] onChunk rejected", err));
      }
    } catch (err) {
      this.err("[MKV-MUXER] onChunk error", err);
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
      return next;
    }

    if (typeof timestampUs !== "number") {
      const fallback = last + durationUs;
      (this as any)[key] = fallback;
      this.warn("[MKV-MUX] video missing ts, fallback:", fallback);
      return fallback;
    }

    if (this.videoTimestampOffsetUs == null) {
      this.videoTimestampOffsetUs = timestampUs;
    }

    const relative = Math.max(
      0,
      timestampUs - this.videoTimestampOffsetUs
    );

    (this as any)[key] = relative;
    return relative;
  }
}
