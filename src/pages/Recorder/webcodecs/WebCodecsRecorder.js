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

    this.debug = options.debug ?? false;
    this.log = (...args) => this.debug && console.log(...args);
    this.warn = (...args) => this.debug && console.warn(...args);
    this.err = (...args) => this.debug && console.error(...args);

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

    this.actualWidth = 0;
    this.actualHeight = 0;

    this.targetWidth = 0;
    this.targetHeight = 0;

    this.videoTimestampOffsetUs = null;
    this.videoFallbackStartMs = null;
    this.selectedVideoCodec = null;
    this.firstVideoFrame = undefined;
    this.frameCount = 0;

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

    this._stopping = false;
    this._videoLoopPromise = null;
    this._audioLoopPromise = null;
  }

  async _probeRealResolution() {
    const processor = new MediaStreamTrackProcessor({ track: this.videoTrack });
    const reader = processor.readable.getReader();

    const { value: frame } = await reader.read();
    if (!frame) throw new Error("Cannot probe frame resolution");

    const width = frame.codedWidth;
    const height = frame.codedHeight;

    this.log("[WCR] Probed resolution:", width, "x", height);
    frame.close();
    reader.releaseLock();

    return { width, height };
  }

  async start() {
    this.videoTimestampOffsetUs = null;
    this.firstVideoFrame = undefined;
    this._stopping = false;

    if (this.running) return this._startPromise;

    this._startPromise = new Promise((resolve) => {
      this._startResolve = resolve;
    });

    this.running = true;
    try {
      this.videoTrack = this.stream.getVideoTracks()[0] || null;
      this.audioTrack = this.stream.getAudioTracks()[0] || null;

      this.log(
        "[WCR] videoTrack",
        this.videoTrack,
        "state=",
        this.videoTrack?.readyState
      );
      this.log(
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
        const { width, height } = await this._probeRealResolution();
        this.actualWidth = width;
        this.actualHeight = height;

        let targetWidth = Math.min(width, 1920);
        let targetHeight = Math.round((height / width) * targetWidth);
        if (targetHeight > 1080) {
          targetHeight = 1080;
          targetWidth = Math.round((width / height) * targetHeight);
        }
        this.targetWidth = targetWidth;
        this.targetHeight = targetHeight;

        this.log("[WCR] Target:", this.targetWidth, "x", this.targetHeight);

        const fps = this.options.fps || 30;
        const safeBitrate = this.options.videoBitrate || 10_000_000;

        const videoConfig = await this.chooseVideoEncoderConfig({
          width: this.targetWidth,
          height: this.targetHeight,
          fps,
          bitrate: safeBitrate,
        });
        this.selectedVideoCodec = videoConfig.codec;

        const audioConfig = await this.prepareAudioEncoderConfig();
        this._pendingAudioConfig = audioConfig;

        this.log("[WCR] Audio config:", audioConfig);

        if (!audioConfig) {
          this.warn("[WCR] No audio available");
          this.options.audioBitrate = undefined;
          this.options.enableAudio = false;
          this._audioReady = false;
        }

        this.videoProcessor = new MediaStreamTrackProcessor({
          track: this.videoTrack,
        });
        this.videoReader = this.videoProcessor.readable.getReader();

        if (audioConfig && this.audioTrack) {
          this.audioProcessor = new MediaStreamTrackProcessor({
            track: this.audioTrack,
          });
          this.audioReader = this.audioProcessor.readable.getReader();
        }

        if (this.audioReader && this.options.enableAudio) {
          this.log("[WCR] start buffering audio");
          this._audioLoopPromise = this.readAudioLoop();
        }

        this.log("[WCR] creating muxer...");
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

        if (this.options.enableAudio) {
          this.muxer.enableAudio();
        }

        await this.muxer.start();
        this.log("[WCR] muxer started");

        await this.initVideoEncoder(videoConfig.config, videoConfig.codec);

        await Promise.resolve();

        setTimeout(() => {
          this._videoLoopPromise = this.readVideoLoop();

          if (this._startResolve) {
            this._startResolve(true);
            this._startResolve = null;
          }
        }, 30);

        this.log("[WCR] start() done");
      } catch (err) {
        this.err("[WCR] start() failed:", err);
        this.options.onError?.(err);
        this.running = false;
        this.cleanup();

        if (this._startResolve) {
          this._startResolve(false);
          this._startResolve = null;
        }
      }
    } catch (err) {
      this.err("[WCR] start() outer error:", err);
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
    this.log("[WCR] stop()", this.frameCount);

    if (this._stopping) {
      this.log("[WCR] stop() already in progress");
      return;
    }
    this._stopping = true;

    if (!this.running) {
      this.log("[WCR] stop() called but recorder not running");
      this._stopping = false;
      return;
    }

    // Soft stop: let loops finish current work
    this.running = false;
    this.paused = true;

    try {
      const loopPromises = [];
      if (this._videoLoopPromise) loopPromises.push(this._videoLoopPromise);
      if (this._audioLoopPromise) loopPromises.push(this._audioLoopPromise);

      if (loopPromises.length) {
        this.log("[WCR] Waiting for read loops to finish before flush...");
        await Promise.race([
          Promise.allSettled(loopPromises),
          new Promise((res) => setTimeout(res, 500)), // safety timeout
        ]);
      }
    } catch (err) {
      this.err("[WCR] Error while waiting for loops:", err);
    }

    try {
      if (this.videoEncoder && this.videoEncoder.state !== "closed") {
        await this.videoEncoder.flush();
      }
      if (this.audioEncoder && this.audioEncoder.state !== "closed") {
        await this.audioEncoder.flush();
      }
    } catch (err) {
      this.err("[WCR] flush error:", err);
      this.options.onError?.(err);
    }

    try {
      if (this.muxer) {
        await this.muxer.finalize();
        if (this.options.onFinalized) {
          await this.options.onFinalized();
        }
      }
    } catch (err) {
      this.err("[WCR] muxer.finalize:", err);
      this.options.onError?.(err);
    }

    this.cleanup();

    if (this.options.onStop) {
      await this.options.onStop();
    }

    this._stopping = false;
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.pauseStartUs = performance.now() * 1000;
  }

  resume() {
    if (!this.running || !this.paused) return;

    const nowUs = performance.now() * 1000;
    this.totalPausedDurationUs += nowUs - this.pauseStartUs;

    this.paused = false;
    this.justResumed = true;
    this.muxer?.setPausedOffset(this.totalPausedDurationUs);
  }

  cleanup() {
    this.log("[WCR] cleanup");

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

    this._videoLoopPromise = null;
    this._audioLoopPromise = null;
  }

  async initVideoEncoder(config, codecLabel) {
    this.log("[WCR] initVideoEncoder()", codecLabel);

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta = {}) => {
        if (this.debug) {
          this.log("[WCR] VIDEO", chunk.type, chunk.timestamp, chunk.duration);
        }
        const normalizedMeta = { ...meta };
        const decoderConfig = normalizedMeta.decoderConfig
          ? { ...normalizedMeta.decoderConfig }
          : {};

        decoderConfig.codec = decoderConfig.codec || codecLabel;
        decoderConfig.codedWidth = decoderConfig.codedWidth || this.targetWidth;
        decoderConfig.codedHeight =
          decoderConfig.codedHeight || this.targetHeight;
        normalizedMeta.decoderConfig = decoderConfig;

        this.muxer.addVideoChunk(chunk, normalizedMeta);
      },
      error: (err) => {
        this.err("[WCR] VideoEncoder error:", err);
        this.options.onError?.(err);
      },
    });

    this.videoEncoder.configure(config);
    this.log("[WCR] VideoEncoder configured");
  }

  async initAudioEncoder(config) {
    if (!config) return;

    this.audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        if (this.debug) this.log("[WCR] AUDIO");
        this.muxer.addAudioChunk(chunk, meta);
      },
      error: (err) => {
        this.err("[WCR] AudioEncoder error:", err);
        this.options.onError?.(err);
      },
    });

    this.audioEncoder.configure(config);

    if (this.muxer && this.videoTimestampOffsetUs != null) {
      this.muxer.setAudioOffset(this.videoTimestampOffsetUs);
    }
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
        this.warn("[WCR] AAC unsupported");
        return null;
      }
      return support.config || candidateConfig;
    } catch {
      this.warn("[WCR] AAC probe failed");
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
      { codec: "avc1.64002A", containerCodec: "avc", hw: "prefer-hardware" },
      { codec: "avc1.4D401F", containerCodec: "avc", hw: "prefer-hardware" },
      { codec: "avc1.42E01E", containerCodec: "avc", hw: "prefer-hardware" },
      { codec: "avc1.64002A", containerCodec: "avc", hw: "prefer-software" },
      { codec: "avc1.4D401F", containerCodec: "avc", hw: "prefer-software" },
      { codec: "avc1.42E01E", containerCodec: "avc", hw: "prefer-software" },
    ];

    for (const c of candidates) {
      const config = { ...base, codec: c.codec, hardwareAcceleration: c.hw };
      try {
        const test = new VideoEncoder({
          output() {},
          error() {},
        });
        test.configure(config);
        test.close();
        this.log("[WCR] Selected encoder:", c.codec, c.hw);
        return {
          config,
          codec: c.codec,
          containerCodec: c.containerCodec,
        };
      } catch (e) {}
    }
    throw new Error("WebCodecsRecorder: No supported H.264 encoder");
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

      return Math.max(0, baseUs - this.totalPausedDurationUs);
    }

    const now = performance.now();
    if (!this._lastFrameTime) this._lastFrameTime = now;
    const delta = now - this._lastFrameTime;
    this._lastFrameTime = now;

    if (delta > 160 && !this._warnedBackpressure) {
      this._warnedBackpressure = true;
      this.warn("[WCR] overload", delta);
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
    this.log("[WCR] video loop start");
    if (!this.videoReader || !this.videoEncoder) return;

    const ensureResizeCanvas = () => {
      if (!this.resizeCanvas) {
        this.resizeCanvas = document.createElement("canvas");
        this.resizeCanvas.width = this.targetWidth;
        this.resizeCanvas.height = this.targetHeight;
        this.resizeCtx = this.resizeCanvas.getContext("2d");
        this.log("[WCR] resize canvas created");
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

        if (done || !frame) break;

        if (frame.codedWidth === 0 || frame.codedHeight === 0) {
          this.warn("[WCR] zero-size frame");
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

        if (this.firstVideoFrame === undefined) {
          this.firstVideoFrame = true;
          this.videoTimestampOffsetUs = frame.timestamp;
          this.log("[WCR] baseline:", this.videoTimestampOffsetUs);

          if (this.muxer)
            this.muxer.setAudioOffset(this.videoTimestampOffsetUs);

          if (!this.audioEncoder && this._pendingAudioConfig) {
            await this.initAudioEncoder(this._pendingAudioConfig);
            await Promise.resolve();
            for (const buf of this._prebufferedAudio) {
              this.audioEncoder.encode(buf);
              buf.close?.();
            }
            this._prebufferedAudio.length = 0;
            this._audioReady = true;
          }
        }

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
      this.err("[WCR] video loop error:", err);
    }

    this.log("[WCR] video loop exit", this.frameCount);
  }

  async readAudioLoop() {
    while (this.paused && this.running) {
      await new Promise((r) => setTimeout(r, 10));
    }
    if (!this.audioReader) return;
    this.log("[WCR] audio loop start");

    try {
      while (this.running) {
        const { value: audioData, done } = await this.audioReader
          .read()
          .catch(() => ({ done: true }));

        if (done || !audioData) break;
        if (!this.audioTrack || this.audioTrack.readyState === "ended") {
          this.warn("[WCR] audio lost");
          this.options.onError?.({ type: "audio-lost" });
          break;
        }

        if (!this._audioReady) {
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
    } catch (err) {
      this.err("[WCR] audio loop error:", err);
    }

    this.log("[WCR] audio loop exit");
  }
}
