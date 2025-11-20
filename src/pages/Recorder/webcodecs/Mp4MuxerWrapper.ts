/*!
 * Screenity WebCodecs Recorder
 * Copyright (c) 2025 Serial Labs Ltd.
 *
 * This file is part of Screenity and is licensed under the GNU GPLv3.
 * See the LICENSE file in the project root for details.
 *
 * This module implements complex WebCodecs-based recording logic
 * for video/audio sync, muxing, and safe timestamp management.
 * If you reuse or modify this file in another project, GPLv3
 * obligations (including copyleft and attribution) apply.
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

export class Mp4MuxerWrapper {
  constructor(options) {
    this.options = options;

    // 🔹 Unified debug toggle + wrappers
    this.debug = options.debug ?? false;
    this.log = (...args) => this.debug && console.log(...args);
    this.warn = (...args) => this.debug && console.warn(...args);
    this.err = (...args) => this.debug && console.error(...args);

    this.target = new BufferTarget();
    this.videoCodec = options.videoCodec || "avc";
    this.audioCodec = options.audioCodec || "aac";
    this.pausedOffsetUs = 0;

    this.ftypChunk = null;
    this.moovChunk = null;
    this.headerEmitted = false;

    this.pendingMoof = null;
    this.pendingMoofTimestampSeconds = null;
    this.fragmentTimestampOffsetSeconds = null;
    this.videoTimestampOffsetUs = null;
    this.audioTimestampOffsetUs = null;
    this.lastVideoTimestampUs = 0;
    this.lastAudioTimestampUs = 0;

    this.started = false;

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
          this.pendingMoofTimestampSeconds =
            this.normalizeFragmentTimestamp(timestampSeconds);
        },
        onMdat: (data) => {
          if (!this.pendingMoof) return;
          const fragment = this.concatChunks([
            this.pendingMoof,
            this.cloneChunk(data),
          ]);
          const tsUs =
            this.pendingMoofTimestampSeconds != null
              ? Math.round(this.pendingMoofTimestampSeconds * 1e6)
              : null;
          this.emitChunk(fragment, tsUs);
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

  addVideoChunk(chunk, meta) {
    const packet = this.buildPacketFromChunk(chunk, meta, "video");
    return this.videoSource.add(packet, meta);
  }

  addAudioChunk(chunk, meta) {
    if (!this.audioSource) {
      this.warn("[MUXER] audioSource missing — ignoring packet");
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
		this.log?.("[MUXER] finalize() called");

		try {
			await this.output.finalize();
		} catch (err) {
			this.err?.("[MUXER] finalize internal error:", err);
		}

		// IMPORTANT: Do NOT read this.target.buffer here
		// It may be gigabytes for long recordings and crash memory.
		this.log?.("[MUXER] finalize completed (streaming mode, no buffer concat)");
	}

  setPausedOffset(offsetUs) {
    this.pausedOffsetUs = offsetUs;
  }

  setAudioOffset(offsetUs) {
    this.audioTimestampOffsetUs = offsetUs;
  }

  emitHeaderIfReady() {
    if (this.headerEmitted || !this.ftypChunk || !this.moovChunk) return;
    const header = this.concatChunks([this.ftypChunk, this.moovChunk]);
    this.headerEmitted = true;
    this.emitChunk(header, 0);
  }

  emitChunk(chunk, timestampUs) {
    try {
      const r = this.options.onChunk?.(chunk, timestampUs ?? null);
      if (r && typeof r.then === "function") {
        r.catch((err) => this.err("[MUXER] onChunk rejected:", err));
      }
    } catch (err) {
      this.err("[MUXER] onChunk error:", err);
    }
  }

  cloneChunk(data) {
    return new Uint8Array(data);
  }

  concatChunks(chunks) {
    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const combined = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      combined.set(c, off);
      off += c.byteLength;
    }
    return combined;
  }

  buildPacketFromChunk(chunk, meta, kind) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    const relativeTimestampUs = this.normalizeSampleTimestamp(
      kind,
      chunk.timestamp,
      chunk.duration || 0
    );

    return new EncodedPacket(
      data,
      chunk.type,
      relativeTimestampUs / 1e6,
      (chunk.duration || 0) / 1e6
    );
  }

  normalizeSampleTimestamp(kind, timestampUs, durationUs = 0) {
    const offsetKey =
      kind === "video" ? "videoTimestampOffsetUs" : "audioTimestampOffsetUs";
    const lastKey =
      kind === "video" ? "lastVideoTimestampUs" : "lastAudioTimestampUs";

    if (typeof timestampUs !== "number") {
      const prev = this[lastKey] ?? 0;
      const next = prev + durationUs;
      this[lastKey] = next;
      return next;
    }

    let base = this[offsetKey];

    if (kind === "audio") {
      if (this.audioTimestampOffsetUs == null) {
        this.audioTimestampOffsetUs = timestampUs;
      }
      base = this.audioTimestampOffsetUs;
    } else if (base == null) {
      base = timestampUs;
      this[offsetKey] = base;
    }

    const relative = Math.max(
      0,
      timestampUs - base - this.pausedOffsetUs
    );

    this[lastKey] = relative;
    return relative;
  }

  normalizeFragmentTimestamp(tsSeconds) {
    if (tsSeconds == null) return null;
    if (this.fragmentTimestampOffsetSeconds == null) {
      this.fragmentTimestampOffsetSeconds = tsSeconds;
    }
    return Math.max(
      0,
      tsSeconds - this.fragmentTimestampOffsetSeconds
    );
  }
}