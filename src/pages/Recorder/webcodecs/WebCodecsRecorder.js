/*!
 * Screenity WebCodecs Recorder
 * Copyright (c) 2025 Serial Labs Ltd.
 *
 * Licensed under the GNU GPLv3.
 * See the LICENSE file for full details.
 *
 * MP4 recording using WebCodecs + MediaBunny.
 * Handles H.264 video, AAC audio, timestamp safety,
 * canvas resizing, pause/resume, and chunked output.
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
    // Monotonic video frame index for safe timestamps
    this._videoFrameIndex = 0;
    this._videoStartUs = null;
    this._frameDurationUs = null;
    this._lastKeyFrameIndex = 0;
    this._keyFrameIntervalFrames = 60;

    this.audioSamplesWritten = 0;
    this.audioSampleRate = null;

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
    this._videoFrameIndex = 0;
    this._videoStartUs = null;
    this._frameDurationUs = null;
    this._lastKeyFrameIndex = 0;
    this.audioSamplesWritten = 0;

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
        this._frameDurationUs = Math.round(1_000_000 / fps);
        this._keyFrameIntervalFrames = Math.max(30, Math.round(fps * 2));
        const safeBitrate = this.options.videoBitrate || 10_000_000;

        const overrideConfig =
          this.options.videoEncoderConfig && typeof this.options.videoEncoderConfig === "object"
            ? this.options.videoEncoderConfig
            : null;

        let videoConfig = null;
        if (overrideConfig) {
          const config = {
            ...overrideConfig,
            width: this.targetWidth,
            height: this.targetHeight,
          };
          this.log("[WCR] Using override encoder config", config);
          try {
            // Verify override is still supported at runtime
            const support = await VideoEncoder.isConfigSupported(config);
            if (support?.supported) {
              videoConfig = {
                config: support.config || config,
                codec: (support.config || config).codec || overrideConfig.codec,
                containerCodec: "avc",
              };
            }
          } catch (err) {
            this.warn("[WCR] Override config unsupported", err);
          }
        }

        if (!videoConfig) {
          videoConfig = await this.chooseVideoEncoderConfig({
            width: this.targetWidth,
            height: this.targetHeight,
            fps,
            bitrate: safeBitrate,
          });
        }
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

        if (audioConfig && this.audioTrack) {
          this.audioProcessor = new MediaStreamTrackProcessor({
            track: this.audioTrack,
          });
          this.audioReader = this.audioProcessor.readable.getReader();
        }

        // Init audio encoder first so _audioReady=true when both loops
        // launch together — avoids audio prebuffering before video starts.
        if (this._pendingAudioConfig) {
          await this.initAudioEncoder(this._pendingAudioConfig);
          this._audioReady = true;
        }

        this.videoProcessor = new MediaStreamTrackProcessor({
          track: this.videoTrack,
        });
        this.videoReader = this.videoProcessor.readable.getReader();

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
          // Start both loops together so t=0 is aligned.
          this._videoLoopPromise = this.readVideoLoop();
          if (this.audioReader && this.options.enableAudio) {
            this.log("[WCR] start audio loop (aligned with video)");
            this._audioLoopPromise = this.readAudioLoop();
          }

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

    // First flush: drain all queued audio and video from the main recording.
    // This is what makes audioSamplesWritten a reliable basis for computing
    // the final audio track duration below.
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

    // Now encode trailing hold frames sized to cover the final audio track
    // end. Done after the first flush so all queued audio has been emitted and
    // audioSamplesWritten reflects the true audio track duration. Without
    // these, the audio track extends past the last video sample and players
    // render the gap as a black frame at the very end.
    //
    // We encode MULTIPLE hold frames (not one long-duration frame) because
    // encoders don't always preserve VideoFrame.duration on the output chunk —
    // a single hold frame with claimed duration=150ms may get written to MP4
    // with duration=0 or the default frameDuration, leaving the track at its
    // pre-hold end. With multiple frames, the muxer derives each sample's
    // duration from the NEXT sample's timestamp, which is naturally correct.
    if (
      this.videoEncoder &&
      this.videoEncoder.state !== "closed" &&
      this.resizeCanvas &&
      this._videoFrameIndex > 0 &&
      this._frameDurationUs
    ) {
      try {
        const sampleRate = this.audioSampleRate || 48000;
        const audioEndUs =
          this.audioSamplesWritten > 0
            ? Math.round((this.audioSamplesWritten * 1_000_000) / sampleRate)
            : 0;
        const holdStartUs = this._videoFrameIndex * this._frameDurationUs;
        // Generous cushion covers both audio-encoder drain lag and any
        // muxer-side rounding. 150ms is imperceptible to a user scrubbing to
        // the end; they see the last captured frame held briefly.
        const cushionUs = 150_000;
        const targetEndUs = Math.max(
          holdStartUs + this._frameDurationUs,
          audioEndUs + cushionUs,
        );
        const framesNeeded = Math.max(
          1,
          Math.ceil((targetEndUs - holdStartUs) / this._frameDurationUs),
        );
        for (let k = 0; k < framesNeeded; k += 1) {
          const tsUs = this._videoFrameIndex * this._frameDurationUs;
          const hold = new VideoFrame(this.resizeCanvas, {
            timestamp: tsUs,
            duration: this._frameDurationUs,
          });
          this.videoEncoder.encode(hold, {
            timestamp: tsUs,
            keyFrame: false,
          });
          hold.close();
          this._videoFrameIndex += 1;
        }
        // Second flush: drain the hold frames.
        await this.videoEncoder.flush();
        this.log("[WCR] trailing hold frames encoded", {
          holdStartUs,
          audioEndUs,
          framesNeeded,
        });
      } catch (err) {
        this.warn("[WCR] trailing hold frames failed:", err);
      }
    }

    // Finalize the muxer with a hard timeout. On abrupt stream end (e.g. user
    // clicks Chrome's "Stop sharing" bar and the video track is torn down
    // mid-pipeline), output.finalize() can hang. With fragmented MP4 +
    // StreamTarget the vast majority of the file has already been streamed
    // to chunksStore throughout the recording, so a hung finalize at most
    // costs us the last fragment (~1s). flushPending() drops the muxer into
    // a closed state and flushes any buffered writes, preserving what we have.
    let muxerFinalizeOk = false;
    if (this.muxer) {
      try {
        await Promise.race([
          this.muxer.finalize().then(() => {
            muxerFinalizeOk = true;
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("muxer-finalize-timeout")),
              5000,
            ),
          ),
        ]);
      } catch (err) {
        this.err("[WCR] muxer.finalize:", err);
        this.options.onError?.(err);
        try {
          await this.muxer.flushPending();
        } catch {}
      }
    }

    // Always invoke onFinalized so the Recorder layer can decide what to do
    // next (validate whatever chunks landed, mark the recording as failed,
    // send video-ready to unblock the editor). Skipping this on finalize
    // failure is what caused the stuck-at-90% bug on stream-end.
    if (this.options.onFinalized) {
      try {
        await this.options.onFinalized({ muxerFinalizeOk });
      } catch (err) {
        this.err("[WCR] onFinalized threw:", err);
      }
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

    // Release any AudioData objects that were queued before the audio encoder
    // was ready.  If encoder init failed, these would otherwise be held in
    // memory indefinitely because readAudioLoop never drained the buffer.
    for (const item of this._prebufferedAudio) {
      try { item.close?.(); } catch {}
    }
    this._prebufferedAudio = [];

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
    this._videoFrameIndex = 0;
    this._videoStartUs = null;
    this._frameDurationUs = null;
    this._lastKeyFrameIndex = 0;
    this.audioSamplesWritten = 0;
    this.audioSampleRate = null;

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
      output: (chunk, meta) => {
        this.muxer.addVideoChunk(chunk, meta);
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
      this.audioSampleRate = support.config?.sampleRate || candidateConfig.sampleRate;
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
        try {
          chrome.storage.local.set({
            fastRecorderSelectedEncoder: {
              codec: c.codec,
              hw: c.hw,
              containerCodec: c.containerCodec,
              width,
              height,
              fps,
              bitrate,
              at: Date.now(),
            },
          });
        } catch {}
        return {
          config,
          codec: c.codec,
          containerCodec: c.containerCodec,
        };
      } catch (e) {}
    }
    throw new Error("WebCodecsRecorder: No supported H.264 encoder");
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

        if (!this._videoStartUs) this._videoStartUs = performance.now() * 1000;

        const nowUs = performance.now() * 1000;
        const elapsedUs = Math.max(
          0,
          nowUs - this._videoStartUs - (this.totalPausedDurationUs || 0)
        );
        const frameDurationUs = this._frameDurationUs || Math.round(1_000_000 / 30);
        const targetIndex = Math.max(0, Math.floor(elapsedUs / frameDurationUs));

        // If we're ahead of wall-clock, drop this frame.
        if (targetIndex < this._videoFrameIndex) {
          frame.close();
          continue;
        }

        // If the tab was hidden or the system was heavily loaded, we can end
        // up many frames behind wall-clock.  Filling the entire gap in one
        // iteration would create hundreds of VideoFrames synchronously and
        // overflow the encoder's internal queue.  Instead, skip ahead to at
        // most MAX_GAP_FRAMES behind the target so the burst is bounded.
        // The skipped indices advance _videoFrameIndex, preventing repeated
        // catch-up attempts on the next iteration.
        const MAX_GAP_FRAMES = 8; // ≈ 267 ms at 30 fps
        const gap = targetIndex - this._videoFrameIndex;
        if (gap > MAX_GAP_FRAMES) {
          this.warn(`[WCR] skipping ${gap - MAX_GAP_FRAMES} frames (tab gap)`);
          this._videoFrameIndex = targetIndex - MAX_GAP_FRAMES;
        }

        const startIndex = this._videoFrameIndex;
        const endIndex = targetIndex;
        for (let i = startIndex; i <= endIndex; i += 1) {
          const tsUs = i * frameDurationUs;
          const resized = new VideoFrame(this.resizeCanvas, {
            timestamp: tsUs,
            duration: frameDurationUs,
          });

          const keyFrame =
            i === 0 ||
            (this.justResumed && i === startIndex) ||
            i - this._lastKeyFrameIndex >= this._keyFrameIntervalFrames;
          if (keyFrame) this._lastKeyFrameIndex = i;
          if (this.justResumed && i === startIndex) {
            this.justResumed = false;
          }

          this.videoEncoder.encode(resized, {
            timestamp: tsUs,
            keyFrame,
          });
          if (this.debug && (this.frameCount < 5 || this.frameCount % 300 === 0)) {
            this.log("[WCR] video pts", {
              frame: this.frameCount,
              tsUs,
              durUs: frameDurationUs,
              targetIndex,
            });
          }
          this.frameCount++;
          this._videoFrameIndex = i + 1;
          resized.close();
        }

        frame.close();
      }
    } catch (err) {
      this.err("[WCR] video loop error:", err);
    }

    this.log("[WCR] video loop exit", this.frameCount, "running=", this.running);
    // If the loop exits while we still think we're recording, the video source
    // died unexpectedly. Stop the audio loop too so the output file's audio
    // track doesn't extend past the last video frame. Don't fire onError —
    // the partial recording is still valid; let the user's stop flow finalize.
    if (this.running) {
      this.warn(
        "[WCR] video loop exited early while running; stopping audio loop",
      );
      this.running = false;
    }
  }

  async readAudioLoop() {
    while (this.paused && this.running) {
      await new Promise((r) => setTimeout(r, 10));
    }
    if (!this.audioReader) return;
    this.log("[WCR] audio loop start");

    const encodeAudioData = (audioData) => {
      const sampleRate =
        audioData.sampleRate || this.audioSampleRate || 48000;
      const frames =
        typeof audioData.numberOfFrames === "number"
          ? audioData.numberOfFrames
          : 0;
      const tsUs = Math.round(
        (this.audioSamplesWritten * 1_000_000) / sampleRate
      );
      const durUs = Math.round((frames * 1_000_000) / sampleRate);

      this.audioEncoder.encode(audioData, {
        timestamp: tsUs,
      });
      this.audioSamplesWritten += frames;

      if (this.debug && (this.audioSamplesWritten === frames || this.audioSamplesWritten % (sampleRate * 10) < frames)) {
        this.log("[WCR] audio pts", {
          samples: this.audioSamplesWritten,
          tsUs,
          durUs,
          sampleRate,
        });
      }
    };

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

        // Drop audio data while the recording is paused.  The sample counter
        // is not advanced, so audio timestamps resume from the correct
        // active-recording position when resume() is called — keeping audio
        // and video aligned across any number of pause/resume cycles.
        if (this.paused) {
          audioData.close?.();
          continue;
        }

        try {
          if (this._prebufferedAudio.length) {
            while (this._prebufferedAudio.length) {
              const buffered = this._prebufferedAudio.shift();
              try {
                encodeAudioData(buffered);
              } finally {
                buffered.close?.();
              }
            }
          }
          encodeAudioData(audioData);
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
