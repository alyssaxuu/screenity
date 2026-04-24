/*!
 * Screenity WebCodecs Recorder - MP4 Muxer Wrapper
 * Licensed under the GNU GPLv3.
 */
// @ts-nocheck

import {
  Output,
  Mp4OutputFormat,
  StreamTarget,
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

// Flush buffered stream writes to chunksStore when we hit ~1MB or 1s,
// whichever first. Small enough that losing the last buffer on a hard crash
// only costs ~1s of video; large enough that chunksStore writes stay cheap.
const FLUSH_BYTES = 1 * 1024 * 1024;
const FLUSH_INTERVAL_MS = 1000;

export class Mp4MuxerWrapper {
  private output: Output;
  private target: StreamTarget;

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

  // Write-buffer state: coalesces many small StreamTarget writes into
  // fewer, larger IDB entries. Fragmented MP4 can emit dozens of tiny
  // writes per second (per-fragment headers, sample data, trailing bytes);
  // without this, IDB would get hammered with small puts.
  private _writeBuffer: Uint8Array[] = [];
  private _writeBufferBytes = 0;
  private _writeBufferTimer: any = null;
  private _pendingFlush: Promise<void> = Promise.resolve();
  private _closed = false;

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

    // Fragmented MP4 via StreamTarget. Writes stream out as fragments are
    // produced throughout recording, so if finalize() hangs or the recorder
    // crashes, chunksStore already holds the vast majority of the file as
    // self-contained fMP4 fragments (moov at start, moof+mdat pairs after).
    // Playable directly in <video> and re-muxable to standard MP4 on
    // download for universal compatibility.
    const writable = new WritableStream<{ data: Uint8Array; position: number; type: string }>({
      write: (chunk) => {
        // With an append-only fragmented output, writes arrive in byte-order
        // and position is monotonic, so we ignore position and just append.
        this.bufferWrite(chunk.data);
      },
    });
    this.target = new StreamTarget(writable);
    this.output = new Output({
      format: new Mp4OutputFormat({
        fastStart: "fragmented",
        // Align fragment boundaries with our keyframe interval (~2s at 30fps).
        // Larger fragments = fewer moof headers overhead; smaller = finer-
        // grained recovery on crash. 1s is a good middle ground.
        minimumFragmentDuration: 1,
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
    // StreamTarget reuses its internal buffer across writes, so we must
    // copy here. Storing the reference would leave us with stale bytes
    // by the time the flush runs.
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

    // Serialize emits via a promise chain so chunksStore sees writes in the
    // order they were produced (critical for file byte-order integrity).
    this._pendingFlush = this._pendingFlush
      .catch(() => {})
      .then(() => this.emitChunk(merged, null));
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
    }

    // Meta is read-only — supply cached decoderConfig when the chunk lacks one.
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
    this.log("[MUXER] start");
    await this.output.start();
    this.started = true;
  }

  async finalize() {
    this.log("[MUXER] finalize");
    try {
      await this.output.finalize();
    } finally {
      // Whatever finalize did (or didn't) write, flush the coalescing
      // buffer and mark closed so late writes are dropped rather than
      // leaking into a future recording.
      this.flushWriteBuffer();
      this._closed = true;
      // Let any in-flight emitChunk calls settle before returning. The
      // caller's onFinalized depends on chunksStore being consistent.
      await this._pendingFlush;
    }
  }

  // Force-flush pending writes without running output.finalize(). Called
  // when the muxer hangs, to preserve whatever fragments have already
  // streamed out so the recording is still recoverable.
  async flushPending() {
    this.flushWriteBuffer();
    this._closed = true;
    await this._pendingFlush;
  }

  // No-op: WebCodecsRecorder already subtracts paused time from timestamps,
  // so a second subtraction here would break monotonicity. Kept for API compat.
  setPausedOffset(_offsetUs: number) {}

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
      // Audio ts is already monotonic from WebCodecsRecorder's sample counter.
      // Just accumulate for logging.
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

    // Pin offset to the first frame so output starts at 0.
    // Don't subtract pausedOffsetUs — WebCodecsRecorder already excludes
    // paused time, and double-subtracting breaks monotonicity.
    if (this.videoTimestampOffsetUs == null) {
      this.videoTimestampOffsetUs = timestampUs;
    }

    const relative = Math.max(
      0,
      timestampUs - this.videoTimestampOffsetUs
    );

    (this as any)[key] = relative;
    this.log(`[MUX] video ts => ${relative}`);

    return relative;
  }
}