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
import { Mp4MuxerWrapper } from "./Mp4MuxerWrapper";

export class WebCodecsRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;

    this.videoTrack = null;
    this.audioTrack = null;

    this.videoProcessor = null;
    this.audioProcessor = null;

    this.videoReader = null;
    this.audioReader = null;

    this.videoEncoder = null;
    this.audioEncoder = null;

    this.muxer = null;

    this.running = false;

    // Capture resolution (what Chrome is giving us)
    this.actualWidth = 0;
    this.actualHeight = 0;

    // Output / encoded resolution (after downscale)
    this.targetWidth = 0;
    this.targetHeight = 0;

    this.videoTimestampOffsetUs = null;
    this.videoFallbackStartMs = null;
    this.selectedVideoCodec = null;
    this.firstVideoFrame = undefined;
    this.frameCount = 0;

    // Resize canvas for downscaling frames
    this.resizeCanvas = null;
    this.resizeCtx = null;

    this.justResumed = false;
    this.paused = false;
    this.pauseStartUs = null;
    this.totalPausedDurationUs = 0;

    this._startPromise = null;
    this._startResolve = null;

    this._prebufferedAudio = [];
    this._audioReady = false;
  }

  async _probeRealResolution() {
    const processor = new MediaStreamTrackProcessor({ track: this.videoTrack });
    const reader = processor.readable.getReader();

    const { value: frame } = await reader.read();
    if (!frame) throw new Error("Cannot probe frame resolution");

    const width = frame.codedWidth;
    const height = frame.codedHeight;

    console.log("[WCR] Probed initial resolution:", width, "x", height);
    frame.close();
    reader.releaseLock();

    return { width, height };
  }

  async start() {
    // Reset offsets
    this.videoTimestampOffsetUs = null;
    this.firstVideoFrame = undefined;
    if (this.running) return this._startPromise;

    this._startPromise = new Promise((resolve) => {
      this._startResolve = resolve;
    });

    this.running = true;
    try {
      this.videoTrack = this.stream.getVideoTracks()[0] || null;
      this.audioTrack = this.stream.getAudioTracks()[0] || null;

      console.log(
        "[WCR] videoTrack",
        this.videoTrack,
        "state=",
        this.videoTrack?.readyState
      );
      console.log(
        "[WCR] audioTrack",
        this.audioTrack,
        "state=",
        this.audioTrack?.readyState
      );

      if (!this.videoTrack) {
        const err = new Error("WebCodecsRecorder: No video track");
        this.options.onError?.(err);
        this.running = false;

        if (this._startResolve) {
          this._startResolve(false);
          this._startResolve = null;
        }

        this._startPromise = null;
        return false;
      }

      try {
        console.log("[WCR] probing real resolution...");
        const { width, height } = await this._probeRealResolution();
        this.actualWidth = width;
        this.actualHeight = height;

        // --- Compute safe target resolution for H.264 ---
        // 1) clamp width to 1920
        let targetWidth = Math.min(width, 1920);
        let targetHeight = Math.round((height / width) * targetWidth);

        // 2) if height > 1080, clamp height and recompute width
        if (targetHeight > 1080) {
          targetHeight = 1080;
          targetWidth = Math.round((width / height) * targetHeight);
        }

        this.targetWidth = targetWidth;
        this.targetHeight = targetHeight;

        console.log(
          "[WCR] Capture resolution:",
          width,
          "x",
          height,
          "→ Target:",
          this.targetWidth,
          "x",
          this.targetHeight
        );

        const fps = this.options.fps || 30;
        const safeBitrate = this.options.videoBitrate || 10_000_000;

        // Choose encoder config (REAL check, not just isConfigSupported)
        const videoConfig = await this.chooseVideoEncoderConfig({
          width: this.targetWidth,
          height: this.targetHeight,
          fps,
          bitrate: safeBitrate,
        });
        this.selectedVideoCodec = videoConfig.codec;

        const audioConfig = await this.prepareAudioEncoderConfig();
        this._pendingAudioConfig = audioConfig;

        console.log("[WCR] Audio config:", audioConfig);

        if (!audioConfig) {
          console.warn(
            "[WCR] No audio track available — disabling audio in muxer"
          );
          this.options.audioBitrate = undefined;
          this.options.enableAudio = false;
          this._audioReady = false;
        }

        console.log("[WCR] creating MediaStreamTrackProcessors...");
        this.videoProcessor = new MediaStreamTrackProcessor({
          track: this.videoTrack,
        });
        this.videoReader = this.videoProcessor.readable.getReader();

        // --- CREATE AUDIO PROCESSOR ---
        if (audioConfig && this.audioTrack) {
          this.audioProcessor = new MediaStreamTrackProcessor({
            track: this.audioTrack,
          });
          this.audioReader = this.audioProcessor.readable.getReader();
        } else {
          this.audioProcessor = null;
          this.audioReader = null;
        }

        if (this.audioReader && this.options.enableAudio) {
          console.log("[WCR] starting early audio buffering loop");
          this.readAudioLoop();
        }

        console.log("[WCR] creating muxer...");
        this.muxer = new Mp4MuxerWrapper({
          width: this.targetWidth,
          height: this.targetHeight,
          fps,
          videoBitrate: this.options.videoBitrate,
          audioBitrate: this.options.audioBitrate,
          videoCodec: videoConfig.containerCodec,
          audioCodec: this.options.enableAudio ? "aac" : undefined,
          onChunk: this.options.onChunk,
        });
        console.log("[WCR] muxer created");

        if (this.options.enableAudio) {
          this.muxer.enableAudio();
        }

        await this.muxer.start();
        console.log("[WCR] muxer started");

        console.log("[WCR] initVideoEncoder()...");
        await this.initVideoEncoder(videoConfig.config, videoConfig.codec);
        console.log("[WCR] initVideoEncoder() done");

        console.log("[WCR] starting read loops after sync...");

        await Promise.resolve(); // microtasks flushed

        setTimeout(() => {
          this.readVideoLoop();

          if (this._startResolve) {
            this._startResolve(true);
            this._startResolve = null;
          }
        }, 30);

        console.log("[WCR] start() completed");
      } catch (err) {
        console.error("[WCR] start() failed:", err);
        this.options.onError?.(err);
        this.running = false;
        this.cleanup();

        if (this._startResolve) {
          this._startResolve(false);
          this._startResolve = null;
        }
      }
    } catch (err) {
      console.error("[WCR] start() outer error:", err);
      this.options.onError?.(err);
      this.running = false;
      this.cleanup();

      if (this._startResolve) {
        this._startResolve(false);
        this._startResolve = null;
      }
    }

    return this._startPromise;
  }

  async stop() {
    console.log("[WCR] stop() called, frames encoded:", this.frameCount);
    if (!this.running) {
      console.log("[WCR] not running, ignoring stop()");
      return;
    }
    this.running = false;

    try {
      if (this.videoEncoder && this.videoEncoder.state !== "closed") {
        console.log("[WCR] flushing video encoder...");
        await this.videoEncoder.flush();
      }
      if (this.audioEncoder && this.audioEncoder.state !== "closed") {
        console.log("[WCR] flushing audio encoder...");
        await this.audioEncoder.flush();
      }
    } catch (err) {
      console.error("[WCR] flush error:", err);
      this.options.onError?.(err);
    }

    try {
      if (this.muxer) {
        console.log("[WCR] finalizing muxer...");
        await this.muxer.finalize();
        console.log("[WCR] muxer finalized");

        if (this.options.onFinalized) {
          await this.options.onFinalized();
        }
      } else {
        console.log("[WCR] no muxer to finalize");
      }
    } catch (err) {
      console.error("[WCR] muxer.finalize error:", err);
      this.options.onError?.(err);
    }

    this.cleanup();

    if (this.options.onStop) {
      await this.options.onStop();
    }
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.pauseStartUs = performance.now() * 1000; // µs
  }

  resume() {
    if (!this.running || !this.paused) return;

    const nowUs = performance.now() * 1000;
    this.totalPausedDurationUs += nowUs - this.pauseStartUs;

    this.paused = false;
    this.justResumed = true;

    // 🟢 CRUCIAL LINE
    this.muxer?.setPausedOffset(this.totalPausedDurationUs);
  }

  cleanup() {
    console.log("[WCR] cleanup()");
    try {
      this.videoReader?.releaseLock();
    } catch {}
    try {
      this.audioReader?.releaseLock();
    } catch {}

    try {
      this.videoEncoder?.close();
    } catch {}
    try {
      this.audioEncoder?.close();
    } catch {}

    // ❌ DO NOT stop the shared capture tracks here.
    // The owner (Recorder) decides when to stop/release them.
    // try { this.videoTrack?.stop(); } catch {}
    // try { this.audioTrack?.stop(); } catch {}

    this.videoProcessor = null;
    this.audioProcessor = null;
    this.videoReader = null;
    this.audioReader = null;
    this.videoEncoder = null;
    this.audioEncoder = null;

    this.videoTrack = null;
    this.audioTrack = null;

    this.videoTimestampOffsetUs = null;
    this.videoFallbackStartMs = null;
    this.firstVideoFrame = undefined;
    this.selectedVideoCodec = null;

    this.resizeCanvas = null;
    this.resizeCtx = null;

    this._startPromise = null;
    this._startResolve = null;
  }

  async initVideoEncoder(config, codecLabel) {
    console.log("[WCR] initVideoEncoder()", codecLabel, config);

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta = {}) => {
        console.log("[WCR] VIDEO CHUNK ENCODED", {
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration,
          byteLength: chunk.byteLength,
        });

        const normalizedMeta = { ...meta };
        const decoderConfig = normalizedMeta.decoderConfig
          ? { ...normalizedMeta.decoderConfig }
          : {};

        // Use encoded resolution for decoder metadata
        decoderConfig.codec = decoderConfig.codec || codecLabel;
        decoderConfig.codedWidth = decoderConfig.codedWidth || this.targetWidth;
        decoderConfig.codedHeight =
          decoderConfig.codedHeight || this.targetHeight;
        normalizedMeta.decoderConfig = decoderConfig;

        this.muxer.addVideoChunk(chunk, normalizedMeta);
      },
      error: (err) => {
        console.error("[WCR] VideoEncoder error:", err);
        this.options.onError?.(err);
      },
    });

    this.videoEncoder.configure(config);
    console.log("[WCR] VideoEncoder configured successfully");
  }

  async initAudioEncoder(config) {
    if (!config) return;

    this.audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        console.log("[WCR] AUDIO CHUNK", chunk, meta);

        this.muxer.addAudioChunk(chunk, meta);
      },
      error: (err) => {
        console.error("[WCR] AudioEncoder error:", err);
        this.options.onError?.(err);
      },
    });

    this.audioEncoder.configure(config);

    // 🔥 align audio base timestamp to video base timestamp
    if (this.muxer && this.videoTimestampOffsetUs != null) {
      this.muxer.setAudioOffset(this.videoTimestampOffsetUs);
    }

    console.log("[WCR] audio encoder OK");
  }

  async prepareAudioEncoderConfig() {
    if (!this.audioTrack) return null;

    const settings = this.audioTrack.getSettings();
    const sampleRate = settings.sampleRate || 48000;
    const numberOfChannels = settings.channelCount || 2;

    const candidateConfig = {
      codec: "mp4a.40.2",
      sampleRate,
      numberOfChannels,
      bitrate: this.options.audioBitrate || 128000,
    };

    try {
      const support = await AudioEncoder.isConfigSupported(candidateConfig);
      if (!support.supported) {
        console.warn("[WCR] AAC encoder unsupported, skipping audio track");
        return null;
      }
      return support.config || candidateConfig;
    } catch (err) {
      console.warn("[WCR] Audio encoder capability probe failed", err);
      return null;
    }
  }

  async chooseVideoEncoderConfig({ width, height, fps, bitrate }) {
    const base = {
      width,
      height,
      framerate: fps,
      bitrate,
      bitrateMode: "constant",
      latencyMode: "realtime",
    };

    const candidates = [
      { codec: "avc1.64002A", containerCodec: "avc", hw: "prefer-hardware" }, // High
      { codec: "avc1.4D401F", containerCodec: "avc", hw: "prefer-hardware" }, // Main
      { codec: "avc1.42E01E", containerCodec: "avc", hw: "prefer-hardware" }, // Baseline
      { codec: "avc1.64002A", containerCodec: "avc", hw: "prefer-software" },
      { codec: "avc1.4D401F", containerCodec: "avc", hw: "prefer-software" },
      { codec: "avc1.42E01E", containerCodec: "avc", hw: "prefer-software" },
    ];

    for (const c of candidates) {
      const config = {
        ...base,
        codec: c.codec,
        hardwareAcceleration: c.hw,
      };

      try {
        // REAL capability check: actually configure an encoder, not just ask.
        const test = new VideoEncoder({
          output() {},
          error(err) {
            console.warn("[WCR] test encoder error for", c.codec, c.hw, err);
          },
        });

        test.configure(config);
        test.close();

        console.log("[WCR] Selected encoder:", c.codec, c.hw);
        return {
          config,
          codec: c.codec,
          containerCodec: c.containerCodec,
        };
      } catch (err) {
        console.warn("[WCR] Unsupported encoder:", c.codec, c.hw, err);
      }
    }

    throw new Error("WebCodecsRecorder: No supported H.264 encoder available");
  }

  getVideoTimestampUs(frame) {
    if (typeof frame.timestamp === "number") {
      if (this.videoTimestampOffsetUs === null) {
        this.videoTimestampOffsetUs = frame.timestamp;
      }

      const baseUs = Math.max(
        0,
        Math.round(frame.timestamp - this.videoTimestampOffsetUs)
      );

      // 🟢 FIX: subtract paused duration
      return Math.max(0, baseUs - this.totalPausedDurationUs);
    }

    // Fallback for browsers without timestamps
    const now = performance.now();
    if (!this._lastFrameTime) this._lastFrameTime = now;
    const delta = now - this._lastFrameTime;
    this._lastFrameTime = now;

    // If encoder falls behind (e.g. >150ms per frame, ~7 FPS)
    if (delta > 160 && !this._warnedBackpressure) {
      this._warnedBackpressure = true;
      console.warn("[WCR] encoding overload detected:", delta, "ms/frame");
      this.options.onError?.({ type: "encoder-overload", delta });
    }
    if (this.videoFallbackStartMs === null) {
      this.videoFallbackStartMs = now;
    }

    const baseUs = Math.max(
      0,
      Math.round((now - this.videoFallbackStartMs) * 1000)
    );

    return Math.max(0, baseUs - this.totalPausedDurationUs);
  }

  async readVideoLoop() {
    console.log("[WCR] video loop starting");
    if (!this.videoReader || !this.videoEncoder) {
      console.error("[WCR] Missing videoReader or videoEncoder!");
      return;
    }

    // lazily init canvas
    const ensureResizeCanvas = () => {
      if (!this.resizeCanvas) {
        this.resizeCanvas = document.createElement("canvas");
        this.resizeCanvas.width = this.targetWidth;
        this.resizeCanvas.height = this.targetHeight;
        this.resizeCtx = this.resizeCanvas.getContext("2d");
        console.log(
          "[WCR] resize canvas created:",
          this.targetWidth,
          "x",
          this.targetHeight
        );
      }
    };

    try {
      while (this.running) {
        if (this.paused) {
          await new Promise((r) => setTimeout(r, 10));
          continue;
        }

        const { value: frame, done } = await this.videoReader
          .read()
          .catch(() => ({ done: true }));

        if (done) {
          console.warn("[WCR] video track ended — stopping");
          this.options.onError?.({ type: "video-ended" });
          break;
        }
        if (!frame) break;

        if (frame.codedWidth === 0 || frame.codedHeight === 0) {
          console.warn("[WCR] zero-size video frame — possible track loss");
          this.options.onError?.({ type: "video-lost" });
        }

        ensureResizeCanvas();

        this.resizeCtx.drawImage(
          frame,
          0,
          0,
          this.targetWidth,
          this.targetHeight
        );

        const resized = new VideoFrame(this.resizeCanvas, {
          timestamp: frame.timestamp,
        });

        const timestampUs = this.getVideoTimestampUs(frame);

        // 🔥 FIRST VIDEO FRAME → establish baseline and init audio
        if (this.firstVideoFrame === undefined) {
          this.firstVideoFrame = true;

          // define baseline
          this.videoTimestampOffsetUs = frame.timestamp;
          console.log(
            "[WCR] Video baseline set to",
            this.videoTimestampOffsetUs
          );

          // apply offset BEFORE any audio arrives
          if (this.muxer)
            this.muxer.setAudioOffset(this.videoTimestampOffsetUs);

          // initialize audio encoder now that baseline exists
          if (!this.audioEncoder && this._pendingAudioConfig) {
            console.log("[WCR] initAudioEncoder AFTER first video frame");
            await this.initAudioEncoder(this._pendingAudioConfig);
            await Promise.resolve(); // flush any encoder microtasks
            // flush prebuffered audio
            for (const buf of this._prebufferedAudio) {
              this.audioEncoder.encode(buf);
              buf.close?.();
            }
            this._prebufferedAudio.length = 0;
            this._audioReady = true;
          }
        }

        // Force first-frame keyframe
        const needsKey =
          this.frameCount === 0 ||
          this.justResumed ||
          this.firstVideoFrame === true;
        this.justResumed = false;

        this.videoEncoder.encode(resized, { keyFrame: needsKey });

        this.frameCount++;

        resized.close();
        frame.close();
      }
    } catch (err) {
      console.error("[WCR] video loop error:", err);
    }

    console.log("[WCR] video loop exited, total frames:", this.frameCount);
  }

  async readAudioLoop() {
    while (this.paused && this.running) {
      await new Promise((r) => setTimeout(r, 10));
    }

    if (!this.audioReader) return; // ❗ remove audioEncoder requirement

    console.log("[WCR] audio loop starting");

    while (this.running) {
      const { value: audioData, done } = await this.audioReader
        .read()
        .catch(() => ({ done: true }));

      if (done || !audioData) {
        console.log("[WCR] audio loop done or no audio", done, audioData);
        break;
      }

      if (!this.audioTrack || this.audioTrack.readyState === "ended") {
        console.warn("[WCR] audio track ended — mic lost");
        this.options.onError?.({ type: "audio-lost" });
        break;
      }

      if (!this._audioReady) {
        // buffer raw audio frames until video baseline is known
        this._prebufferedAudio.push(audioData);
        continue;
      }

      try {
        this.audioEncoder.encode(audioData);
      } catch (err) {
        audioData.close?.();
        this.options.onError?.(err);
        break;
      }

      audioData.close?.();
    }

    console.log("[WCR] audio loop exited");
  }
}
