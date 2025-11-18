// webcodecs/Mp4MuxerWrapper.ts
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
  onChunk: (
    chunk: Uint8Array,
    timestampUs: number | null
  ) => void | Promise<void>;
}

export class Mp4MuxerWrapper {
  private options: Mp4MuxerWrapperOptions;

  private output: Output;
  private target: BufferTarget;

  private videoSource: EncodedVideoPacketSource;
  private audioSource: EncodedAudioPacketSource | null = null;
  private videoCodec: string;
  private audioCodec: string;

  private ftypChunk: Uint8Array | null = null;
  private moovChunk: Uint8Array | null = null;
  private headerEmitted = false;

  private pendingMoof: Uint8Array | null = null;
  private pendingMoofTimestampSeconds: number | null = null;
  private fragmentTimestampOffsetSeconds: number | null = null;
  private videoTimestampOffsetUs: number | null = null;
  private audioTimestampOffsetUs: number | null = null;
  private lastVideoTimestampUs = 0;
  private lastAudioTimestampUs = 0;

  private started = false;

  constructor(options: Mp4MuxerWrapperOptions) {
    this.options = options;

    this.target = new BufferTarget();
    this.videoCodec = options.videoCodec || "avc";
    this.audioCodec = options.audioCodec || "aac";

    const minFragmentDuration = Math.max(
      0.2,
      (this.options.fps ? 1 / this.options.fps : 1 / 30) * 6
    );

    this.output = new Output({
      format: new Mp4OutputFormat({
        fastStart: "in-memory",
        minimumFragmentDuration: minFragmentDuration,
        onFtyp: (data) => {
          this.ftypChunk = this.cloneChunk(data);
          this.emitHeaderIfReady();
        },
        onMoov: (data) => {
          this.moovChunk = this.cloneChunk(data);
          this.emitHeaderIfReady();
        },
        onMoof: (data, _pos, timestampSeconds = 0) => {
          this.pendingMoof = this.cloneChunk(data);
          this.pendingMoofTimestampSeconds = this.normalizeFragmentTimestamp(
            timestampSeconds
          );
        },
        onMdat: (data) => {
          if (!this.pendingMoof) {
            return;
          }
          const fragment = this.concatChunks([
            this.pendingMoof,
            this.cloneChunk(data),
          ]);
          const timestampUs =
            this.pendingMoofTimestampSeconds != null
              ? Math.round(this.pendingMoofTimestampSeconds * 1e6)
              : null;
          this.emitChunk(fragment, timestampUs);
          this.pendingMoof = null;
          this.pendingMoofTimestampSeconds = null;
        },
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
      this.audioSource = new EncodedAudioPacketSource(this.audioCodec);
      this.output.addAudioTrack(this.audioSource);
    }
  }

  addVideoChunk(chunk: EncodedVideoChunk, meta: any) {
    const packet = this.buildPacketFromChunk(chunk, meta, "video");
    return this.videoSource.add(packet, meta);
  }

  addAudioChunk(chunk: EncodedAudioChunk, meta: any) {
    if (!this.audioSource) {
      console.warn("[MUXER] audioSource missing — ignoring audio packet");
      return;
    }
    const packet = this.buildPacketFromChunk(chunk, meta, "audio");
    return this.audioSource.add(packet, meta);
  }

  async start() {
    if (this.started) return;
    await this.output.start();
    this.started = true;
  }

  async finalize() {
    await this.output.finalize();

    const data = this.target.buffer;
    if (data && data.byteLength > 0) {
      this.emitChunk(new Uint8Array(data), null);
    }
  }

  private emitHeaderIfReady() {
    if (this.headerEmitted || !this.ftypChunk || !this.moovChunk) {
      return;
    }
    const header = this.concatChunks([this.ftypChunk, this.moovChunk]);
    this.headerEmitted = true;
    this.emitChunk(header, 0);
  }

  private emitChunk(chunk: Uint8Array, timestampUs: number | null) {
    try {
      const result = this.options.onChunk?.(chunk, timestampUs ?? null);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        Promise.resolve(result).catch((err) => {
          console.error("[MUXER] onChunk rejected", err);
        });
      }
    } catch (err) {
      console.error("[MUXER] onChunk error", err);
    }
  }

  private cloneChunk(data: Uint8Array) {
    return new Uint8Array(data);
  }

  private concatChunks(chunks: Uint8Array[]) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return combined;
  }

  private buildPacketFromChunk(
    chunk: EncodedVideoChunk | EncodedAudioChunk,
    meta: any,
    kind: "video" | "audio"
  ) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    const relativeTimestampUs = this.normalizeSampleTimestamp(
      kind,
      chunk.timestamp,
      chunk.duration || 0
    );
    const durationSeconds = (chunk.duration || 0) / 1e6;

    return new EncodedPacket(
      data,
      chunk.type,
      relativeTimestampUs / 1e6,
      durationSeconds
    );
  }

  private normalizeSampleTimestamp(
    kind: "video" | "audio",
    timestampUs?: number,
    durationUs: number = 0
  ) {
    const offsetKey =
      kind === "video" ? "videoTimestampOffsetUs" : "audioTimestampOffsetUs";
    const lastKey =
      kind === "video" ? "lastVideoTimestampUs" : "lastAudioTimestampUs";

    if (typeof timestampUs !== "number") {
      const next = (this[lastKey] || 0) + durationUs;
      this[lastKey] = next;
      return next;
    }

    if (this[offsetKey] === null) {
      this[offsetKey] = timestampUs;
    }

    const relative = Math.max(0, timestampUs - (this[offsetKey] || 0));
    this[lastKey] = relative;
    return relative;
  }

  private normalizeFragmentTimestamp(timestampSeconds: number | null | undefined) {
    if (timestampSeconds == null) {
      return null;
    }
    if (this.fragmentTimestampOffsetSeconds == null) {
      this.fragmentTimestampOffsetSeconds = timestampSeconds;
    }
    return Math.max(
      0,
      timestampSeconds - this.fragmentTimestampOffsetSeconds
    );
  }
}
