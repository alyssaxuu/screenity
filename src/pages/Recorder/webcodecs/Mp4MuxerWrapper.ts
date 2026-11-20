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
  onMuxError?: (err: any, kind: "video" | "audio") => void;
  debug?: boolean;
}

// Flush buffered stream writes at ~1MB or 1s. Bounds last-buffer loss on
// hard crash to ~1s of video while keeping chunksStore writes cheap.
const FLUSH_BYTES = 1 * 1024 * 1024;
const FLUSH_INTERVAL_MS = 1000;

// The Output holds all video until every open track has delivered a first
// sample, so an open audio track that never delivers keeps the file at its
// 28-byte header. Close it once video is clearly flowing without it.
const AUDIO_NEVER_STARTED_CLOSE_MS = 6000;
const AUDIO_GAP_CLOSE_MS = 15000;
const VIDEO_FLOWING_MS = 4000;

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
  private _audioClosed = false;
  private _muxErrorReported = false;

  private _firstVideoAddAt: number | null = null;
  private _lastVideoAddAt: number | null = null;
  private _audioSampleRate: number | null = null;
  private _lastAudioAddAt: number | null = null;
  private _audioBaselineAt: number | null = null;
  private _audioIdleTimer: any = null;
  private _stats = {
    videoAdds: 0,
    videoSettled: 0,
    videoRejected: 0,
    firstAddHadConfig: null as boolean | null,
    audioAdds: 0,
    audioIdleClosed: false,
    audioDurationFallbacks: 0,
    bytesWritten: 0,
  };

  // Coalesces small StreamTarget writes (per-fragment headers, sample data,
  // trailing bytes) into fewer larger IDB puts.
  private _writeBuffer: Uint8Array[] = [];
  private _writeBufferBytes = 0;
  private _writeBufferTimer: any = null;
  private _pendingFlush: Promise<void> = Promise.resolve();
  private _closed = false;

  // Bytes streamed to onChunk. When the file ends up empty, near-zero blames the
  // encoder (header only); large here means the loss is in the OPFS write/close path.
  private _totalEmittedBytes = 0;
  private _emitCount = 0;

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

    // Fragmented MP4: if finalize() hangs or the recorder crashes,
    // chunksStore already holds self-contained fMP4 fragments
    // (moov at start, moof+mdat pairs after) playable in <video>.
    const writable = new WritableStream<{ data: Uint8Array; position: number; type: string }>({
      write: (chunk) => {
        // Append-only fragmented output: position is monotonic, ignore it.
        this.bufferWrite(chunk.data);
      },
    });
    this.target = new StreamTarget(writable);
    this.output = new Output({
      format: new Mp4OutputFormat({
        fastStart: "fragmented",
        // 1s balances moof overhead vs crash-recovery granularity.
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
    this._stats.bytesWritten += data.byteLength;
    // StreamTarget reuses its internal buffer across writes; must copy.
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

    // Serialize emits so chunksStore sees writes in produced order
    // (critical for file byte-order integrity).
    this._pendingFlush = this._pendingFlush
      .catch(() => {})
      .then(() => this.emitChunk(merged, null));
  }

  enableAudio() {
    if (!this.audioSource) {
      this.log("[MUXER] enableAudio");
      this.audioSource = new EncodedAudioPacketSource(this.audioCodec);
      this.output.addAudioTrack(this.audioSource);
      this.startAudioIdleWatch();
    }
  }

  private startAudioIdleWatch() {
    if (this._audioIdleTimer) return;
    this._audioIdleTimer = setInterval(() => {
      if (this._audioClosed || !this.audioSource) return this.stopAudioIdleWatch();
      if (this._firstVideoAddAt == null || this._lastVideoAddAt == null) return;
      const now = Date.now();
      // A pause stops both tracks; the audio gap it leaves is not a dead source.
      if (now - this._lastVideoAddAt > VIDEO_FLOWING_MS) return;
      const neverStarted = this._lastAudioAddAt == null;
      const since = Math.max(
        this._lastAudioAddAt ?? this._firstVideoAddAt,
        this._audioBaselineAt ?? 0,
      );
      const limit = neverStarted ? AUDIO_NEVER_STARTED_CLOSE_MS : AUDIO_GAP_CLOSE_MS;
      if (now - since < limit) return;
      this.warn("[MUXER] audio idle while video flows, closing audio source");
      this._stats.audioIdleClosed = true;
      this.closeAudio();
    }, 1000);
  }

  private stopAudioIdleWatch() {
    if (this._audioIdleTimer) {
      clearInterval(this._audioIdleTimer);
      this._audioIdleTimer = null;
    }
  }

  // Packet buffering: the Output waits for audio at every timestamp, so a dead
  // audio track stops all fragment writes and buffers video in memory.
  closeAudio() {
    if (!this.audioSource || this._audioClosed) return;
    this._audioClosed = true;
    this.stopAudioIdleWatch();
    this.log("[MUXER] closeAudio");
    try {
      this.audioSource.close();
    } catch (err) {
      this.warn("[MUXER] closeAudio threw", err);
    }
  }

  // finalize() still resolves after a rejected add(), so dropped packets ship
  // as a valid but empty recording. Report the first one.
  private trackAdd(p: any, kind: "video" | "audio") {
    if (!(p instanceof Promise)) return p;
    return p.catch((err) => {
      if (this._muxErrorReported) return;
      this._muxErrorReported = true;
      this.err(`[MUXER] ${kind} add failed`, err);
      try {
        this.options.onMuxError?.(err, kind);
      } catch {}
    });
  }

  addVideoChunk(chunk: EncodedVideoChunk, meta: any) {
    if (meta?.decoderConfig) {
      this._lastDecoderConfig = meta.decoderConfig;
    }

    // Supply cached decoderConfig when chunk lacks one.
    const effectiveMeta =
      !meta?.decoderConfig && this._lastDecoderConfig
        ? { ...meta, decoderConfig: this._lastDecoderConfig }
        : meta;

    const nowMs = Date.now();
    if (this._firstVideoAddAt === null) this._firstVideoAddAt = nowMs;
    if (
      this._lastVideoAddAt !== null &&
      nowMs - this._lastVideoAddAt > VIDEO_FLOWING_MS
    ) {
      this._audioBaselineAt = nowMs;
    }
    this._lastVideoAddAt = nowMs;
    if (this._stats.firstAddHadConfig === null) {
      this._stats.firstAddHadConfig = !!effectiveMeta?.decoderConfig;
    }
    this._stats.videoAdds += 1;

    const packet = this.buildPacket(chunk, effectiveMeta, "video");
    let added: any;
    try {
      added = this.videoSource.add(packet, effectiveMeta);
    } catch {
      // Thrown synchronously when the output is finalizing or the source is
      // closed, which late encoder output after stop can hit.
      this._stats.videoRejected += 1;
      return;
    }
    if (added instanceof Promise) {
      added.then(
        () => {
          this._stats.videoSettled += 1;
        },
        () => {
          this._stats.videoRejected += 1;
        },
      );
    }
    return this.trackAdd(added, "video");
  }

  addAudioChunk(chunk: EncodedAudioChunk, meta: any) {
    if (!this.audioSource || this._audioClosed) return;

    this._lastAudioAddAt = Date.now();
    this._stats.audioAdds += 1;
    const packet = this.buildPacket(chunk, meta, "audio");
    let added: any;
    try {
      added = this.audioSource.add(packet, meta);
    } catch {
      return;
    }
    return this.trackAdd(added, "audio");
  }

  async start() {
    if (this.started) return;
    this.log("[MUXER] start");
    await this.output.start();
    this.started = true;
  }

  async finalize() {
    this.log("[MUXER] finalize");
    this.stopAudioIdleWatch();
    try {
      await this.output.finalize();
    } finally {
      // Flush coalescing buffer and close so late writes don't leak
      // into a future recording.
      this.flushWriteBuffer();
      this._closed = true;
      // Let in-flight emitChunk calls settle; caller's onFinalized
      // depends on chunksStore being consistent.
      await this._pendingFlush;
    }
  }

  // Force-flush without finalize(). Used when the muxer hangs to preserve
  // already-streamed fragments for recovery.
  async flushPending() {
    this.stopAudioIdleWatch();
    this.flushWriteBuffer();
    this._closed = true;
    await this._pendingFlush;
  }

  // Read at stop to blame an empty file on the encoder (near-zero) vs the write path.
  getStats() {
    return {
      totalEmittedBytes: this._totalEmittedBytes,
      emitCount: this._emitCount,
      muxVideoAdds: this._stats.videoAdds,
      muxVideoSettled: this._stats.videoSettled,
      muxVideoRejected: this._stats.videoRejected,
      muxFirstAddHadConfig: this._stats.firstAddHadConfig,
      muxBytesWritten: this._stats.bytesWritten,
      muxAudioAdds: this._stats.audioAdds,
      muxAudioTrackOpen: !!this.audioSource && !this._audioClosed,
      muxAudioIdleClosed: this._stats.audioIdleClosed,
      muxAudioDurationFallbacks: this._stats.audioDurationFallbacks,
    };
  }

  // No-op: WebCodecsRecorder already subtracts paused time; double-subtract
  // would break monotonicity. Kept for API compat.
  setPausedOffset(_offsetUs: number) {}

  setAudioOffset(offsetUs: number) {
    this.audioTimestampOffsetUs = offsetUs;
  }

  private emitChunk(chunk: Uint8Array, timestampUs: number | null) {
    this._totalEmittedBytes += chunk.byteLength;
    this._emitCount += 1;
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

    let durUs = chunk.duration || 0;
    if (type === "audio") {
      const sr = meta?.decoderConfig?.sampleRate
      if (typeof sr === "number" && sr > 0) this._audioSampleRate = sr;
      if (!(durUs > 0)) {
        // Audio time is built as last + duration, so a missing duration would
        // freeze the audio timeline at 0 and keep the Output waiting on audio.
        durUs =
          this.audioCodec === "aac"
            ? Math.round((1024 * 1_000_000) / (this._audioSampleRate || 48000))
            : 20_000;
        this._stats.audioDurationFallbacks += 1;
      }
    }
    const tsUs = this.normalizeTimestamp(type, chunk.timestamp, durUs);
    const durSec = durUs / 1e6;

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
      // Audio ts is monotonic from WebCodecsRecorder's sample counter.
      const next = last + durationUs;
      (this as any)[key] = next;
      this.log(`[MUX] audio ts +${durationUs} => ${next}`);
      // AAC chunk.duration is unreliable (w3c/webcodecs#624), so our accumulated
      // ts can drift from chunk.ts. Log when drift exceeds 100ms, once per ~30s.
      if (
        typeof timestampUs === "number" &&
        timestampUs > 0 &&
        !(this as any)._audioFirstTimestampUs
      ) {
        (this as any)._audioFirstTimestampUs = timestampUs;
      }
      const firstTs = (this as any)._audioFirstTimestampUs || 0;
      if (firstTs && typeof timestampUs === "number") {
        const expectedAccum = timestampUs - firstTs;
        const drift = Math.abs(next - expectedAccum);
        if (
          drift > 100_000 &&
          next - ((this as any)._audioDriftLogAt || 0) > 30_000_000
        ) {
          (this as any)._audioDriftLogAt = next;
          this.warn(`[MUX] audio ts drift accum=${next} vs chunk.ts=${expectedAccum} (delta=${drift}us)`);
        }
      }
      return next;
    }

    if (typeof timestampUs !== "number") {
      const fallback = last + durationUs;
      (this as any)[key] = fallback;
      this.warn("[MUX] video missing ts, fallback:", fallback);
      return fallback;
    }

    // Pin offset to first frame so output starts at 0. Don't subtract
    // pausedOffsetUs: WebCodecsRecorder already excludes paused time.
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