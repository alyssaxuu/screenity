// extension/webcodecs/WebCodecsRecorder.js
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
    console.log("[WCR] start() called");
    if (this.running) {
      console.log("[WCR] already running, ignoring start()");
      return;
    }

    this.running = true;

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
      console.error("[WCR] error:", err);
      this.options.onError?.(err);
      this.running = false;
      return;
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

      console.log("[WCR] Video config chosen:", videoConfig);
      console.log("[WCR] Audio config:", audioConfig);

      console.log("[WCR] creating MediaStreamTrackProcessors...");
      this.videoProcessor = new MediaStreamTrackProcessor({
        track: this.videoTrack,
      });
      this.videoReader = this.videoProcessor.readable.getReader();

      if (audioConfig && this.audioTrack) {
        this.audioProcessor = new MediaStreamTrackProcessor({
          track: this.audioTrack,
        });
        this.audioReader = this.audioProcessor.readable.getReader();
      } else {
        this.audioProcessor = null;
        this.audioReader = null;
      }

      console.log("[WCR] creating muxer...");
      this.muxer = new Mp4MuxerWrapper({
        width: this.targetWidth,
        height: this.targetHeight,
        fps,
        videoBitrate: this.options.videoBitrate,
        audioBitrate: this.options.audioBitrate,
        videoCodec: videoConfig.containerCodec,
        audioCodec: audioConfig ? "aac" : undefined,
        onChunk: this.options.onChunk,
      });
      console.log("[WCR] muxer created");

      if (audioConfig) {
        this.muxer.enableAudio();
      }

      await this.muxer.start();
      console.log("[WCR] muxer started");

      console.log("[WCR] initVideoEncoder()...");
      await this.initVideoEncoder(videoConfig.config, videoConfig.codec);
      console.log("[WCR] initVideoEncoder() done");

      if (audioConfig) {
        console.log("[WCR] initAudioEncoder()...");
        await this.initAudioEncoder(audioConfig);
        console.log("[WCR] initAudioEncoder() done");
      } else {
        console.log("[WCR] audio encoder skipped (unsupported or no track)");
      }

      console.log("[WCR] starting read loops...");
      this.readVideoLoop();
      if (this.audioReader && this.audioEncoder) {
        this.readAudioLoop();
      }
      console.log("[WCR] start() completed");
    } catch (err) {
      console.error("[WCR] start() failed:", err);
      this.options.onError?.(err);
      this.running = false;
      this.cleanup();
    }
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

    try {
      this.videoTrack?.stop();
    } catch {}
    try {
      this.audioTrack?.stop();
    } catch {}

    this.videoProcessor = null;
    this.audioProcessor = null;
    this.videoReader = null;
    this.audioReader = null;
    this.videoEncoder = null;
    this.audioEncoder = null;
    this.videoTimestampOffsetUs = null;
    this.videoFallbackStartMs = null;
    this.firstVideoFrame = undefined;
    this.selectedVideoCodec = null;

    this.resizeCanvas = null;
    this.resizeCtx = null;
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
      return Math.max(
        0,
        Math.round(frame.timestamp - this.videoTimestampOffsetUs)
      );
    }

    const now = performance.now();
    if (this.videoFallbackStartMs === null) {
      this.videoFallbackStartMs = now;
    }
    return Math.max(0, Math.round((now - this.videoFallbackStartMs) * 1000));
  }

  async readVideoLoop() {
    console.log("[WCR] video loop starting");
    if (!this.videoReader || !this.videoEncoder) {
      console.error("[WCR] Missing videoReader or videoEncoder!");
      return;
    }

    // Lazily init resize canvas on first frame
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
        let readResult;
        try {
          readResult = await this.videoReader.read();
        } catch (err) {
          console.error("[WCR] videoReader.read() error:", err);
          break;
        }

        const { value: frame, done } = readResult;

        if (done || !frame) {
          console.log("[WCR] video loop done or no frame", done, !!frame);
          break;
        }

        console.log("[WCR] got VIDEO FRAME", {
          frameNumber: this.frameCount,
          ts: frame.timestamp,
          codedWidth: frame.codedWidth,
          codedHeight: frame.codedHeight,
          format: frame.format,
        });

        ensureResizeCanvas();

        // Draw original frame to canvas → downscale to target
        this.resizeCtx.drawImage(
          frame,
          0,
          0,
          this.targetWidth,
          this.targetHeight
        );

        // Create new VideoFrame from the resized canvas
        const resized = new VideoFrame(this.resizeCanvas, {
          timestamp: frame.timestamp,
        });

        const timestampUs = this.getVideoTimestampUs(frame);

        try {
          const isFirstFrame = this.firstVideoFrame === undefined;
          if (isFirstFrame) this.firstVideoFrame = true;

          // Force keyframe every 2 seconds or on first frame
          const framesSinceKey = this.frameCount % (this.options.fps * 2 || 60);
          const needsKey = isFirstFrame || framesSinceKey === 0;

          console.log("[WCR] Encoding frame", this.frameCount, {
            timestampUs,
            keyFrame: needsKey,
            encoderQueueSize: this.videoEncoder.encodeQueueSize,
            encoderState: this.videoEncoder.state,
          });

          // encode resized frame; timestamp comes from frame.timestamp
          this.videoEncoder.encode(resized, {
            keyFrame: needsKey,
          });

          this.frameCount++;
        } catch (err) {
          console.error("[WCR] video encode error", err);
          this.options.onError?.(err);
          resized.close();
          frame.close();
          break;
        }

        resized.close();
        frame.close();
      }
    } catch (err) {
      console.error("[WCR] video loop error:", err);
    }

    console.log("[WCR] video loop exited, total frames:", this.frameCount);
  }

  async readAudioLoop() {
    if (!this.audioReader || !this.audioEncoder) return;

    console.log("[WCR] audio loop starting");

    while (this.running) {
      const { value: audioData, done } = await this.audioReader
        .read()
        .catch(() => ({ done: true }));
      if (done || !audioData) {
        console.log("[WCR] audio loop done or no audio", done, audioData);
        break;
      }

      console.log("[WCR] got AUDIO FRAME", audioData);

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
