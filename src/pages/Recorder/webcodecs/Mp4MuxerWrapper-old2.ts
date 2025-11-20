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
	StreamTarget,
	StreamTargetChunk,
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
	private target: StreamTarget;

	private videoSource: EncodedVideoPacketSource;
	private audioSource: EncodedAudioPacketSource | null = null;
	private videoCodec: string;
	private audioCodec: string;

	// We no longer manually track ftyp/moov/moof/mdat here. StreamTarget
	// will give us the final MP4 in order, chunk by chunk.
	private headerEmitted = false;

	private fragmentTimestampOffsetSeconds: number | null = null;
	private videoTimestampOffsetUs: number | null = null;
	private audioTimestampOffsetUs: number | null = null;
	private lastVideoTimestampUs = 0;
	private lastAudioTimestampUs = 0;
	private pausedOffsetUs: number;

	private started = false;

	constructor(options: Mp4MuxerWrapperOptions) {
		this.options = options;

		this.videoCodec = options.videoCodec || "avc";
		this.audioCodec = options.audioCodec || "aac";
		this.pausedOffsetUs = 0;

		const minFragmentDuration = Math.max(
			0.2,
			(this.options.fps ? 1 / this.options.fps : 1 / 30) * 6
		);

		// StreamTarget: lets us stream bytes out incrementally instead of
		// ever materializing a single huge ArrayBuffer in memory.
		const writable = new WritableStream<StreamTargetChunk>({
			write: (chunk) => {
				// In fragmented fast-start mode, Mp4OutputFormat writes in
				// append-only order, so simply appending all Uint8Arrays in
				// arrival order yields a valid fMP4 file.
				//
				// Your existing IndexedDB “chunksStore” can keep doing:
				//   chunks.push(chunk.data)
				// and later:
				//   new Blob(chunks, { type: "video/mp4" })
				//
				// We don’t have an exact fragment timestamp here, so we just
				// pass null. If you really want, you can plumb something like
				// this.lastVideoTimestampUs instead.
				this.emitChunk(chunk.data, null);
			},
		});

		this.target = new StreamTarget(writable, {
			// Chunked mode: accumulate into reasonably sized chunks before
			// emitting, to keep `onChunk` frequency sane.
			chunked: true,
			chunkSize: 2 ** 20, // 1 MiB; tweak if you want bigger/smaller IDB chunks
		});

		this.output = new Output({
			target: this.target,
			format: new Mp4OutputFormat({
				// Key part: fragmented fast-start → append-only writes,
				// suitable for streaming / simple concatenation.
				fastStart: "fragmented",
				minimumFragmentDuration: minFragmentDuration,
			}),
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
		// Important: with StreamTarget this *no longer* allocates a giant
		// ArrayBuffer. It just finishes writing and closes the stream.
		await this.output.finalize();
		// Nothing else to emit here: all data (including header + tail)
		// has already gone through the WritableStream → onChunk path.
	}

	setPausedOffset(offsetUs: number) {
		this.pausedOffsetUs = offsetUs;
	}

	setAudioOffset(offsetUs: number) {
		this.audioTimestampOffsetUs = offsetUs;
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

		// Fallback when encoder doesn’t give timestamps
		if (typeof timestampUs !== "number") {
			const prev = (this as any)[lastKey] ?? 0;
			const next = prev + durationUs;
			(this as any)[lastKey] = next;
			return next;
		}

		let baseOffset = (this as any)[offsetKey] as number | null;

		// If we explicitly set an audio offset, prefer that
		if (kind === "audio") {
			if (this.audioTimestampOffsetUs == null) {
				this.audioTimestampOffsetUs = timestampUs;
			}
			baseOffset = this.audioTimestampOffsetUs;
		} else if (baseOffset == null) {
			// First sample for this track: establish base offset
			baseOffset = timestampUs;
			(this as any)[offsetKey] = baseOffset;
		}

		const relative = Math.max(
			0,
			timestampUs - baseOffset - this.pausedOffsetUs
		);

		(this as any)[lastKey] = relative;
		return relative;
	}

	private normalizeFragmentTimestamp(
		timestampSeconds: number | null | undefined
	) {
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