declare const chrome: any;

export type FastRecorderProbeResult = {
  ok: boolean;
  reasons: string[];
  details: Record<string, any>;
  at?: number;
};

export type FastRecorderStickyState = {
  disabled: boolean;
  reason?: string | null;
  details?: any;
};

export type FastRecorderValidationResult = {
  ok: boolean;
  hardFail: boolean;
  reasons: string[];
  details: Record<string, any>;
};

const STORAGE_KEYS = {
  userSetting: "fastRecorderBeta",
  stickyDisabled: "fastRecorderDisabledForDevice",
  stickyReason: "fastRecorderDisabledReason",
  stickyDetails: "fastRecorderDisabledDetails",
  lastFailureAt: "fastRecorderDisabledAt",
  probe: "fastRecorderProbe",
  validation: "fastRecorderValidation",
  inUse: "fastRecorderInUse",
};

const GATE_VERSION = "ladder-v1";

const getFastRecDebug = () => {
  try {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("fastRecDebug") === "1") return true;
    }
  } catch {}
  return (globalThis as any)?.SCREENITY_FAST_REC_DEBUG === true;
};

const debugLog = (...args: any[]) => {
  if (!getFastRecDebug()) return;
  // eslint-disable-next-line no-console
  console.log("[FastRecorderGate]", ...args);
};

debugLog("gate version", GATE_VERSION, Date.now());

const safeCanPlayType = (mime: string) => {
  try {
    if (typeof document === "undefined") return "";
    const video = document.createElement("video");
    return video?.canPlayType?.(mime) || "";
  } catch {
    return "";
  }
};

const safeMseSupport = (mime: string) => {
  try {
    if (typeof MediaSource === "undefined") return false;
    return MediaSource.isTypeSupported(mime);
  } catch {
    return false;
  }
};

export const getFastRecorderStickyState = async (): Promise<FastRecorderStickyState> => {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.stickyDisabled,
      STORAGE_KEYS.stickyReason,
      STORAGE_KEYS.stickyDetails,
    ]);
    return {
      disabled: Boolean(result[STORAGE_KEYS.stickyDisabled]),
      reason: result[STORAGE_KEYS.stickyReason] || null,
      details: result[STORAGE_KEYS.stickyDetails] || null,
    };
  } catch {
    return { disabled: false };
  }
};

export const markFastRecorderFailure = async (
  reasonCode: string,
  details: Record<string, any> = {}
) => {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.stickyDisabled]: true,
      [STORAGE_KEYS.stickyReason]: reasonCode,
      [STORAGE_KEYS.stickyDetails]: details,
      [STORAGE_KEYS.lastFailureAt]: Date.now(),
    });
  } catch {
    // ignore
  }
};

export const probeFastRecorderSupport = async (): Promise<FastRecorderProbeResult> => {
  try {
    debugLog("probe start", GATE_VERSION, Date.now());
    const reasons: string[] = [];
    const details: Record<string, any> = {};

    const hasVideoEncoder = typeof VideoEncoder !== "undefined";
    const hasAudioEncoder = typeof AudioEncoder !== "undefined";
    const hasTrackProcessor = typeof MediaStreamTrackProcessor !== "undefined";

    details.hasVideoEncoder = hasVideoEncoder;
    details.hasAudioEncoder = hasAudioEncoder;
    details.hasTrackProcessor = hasTrackProcessor;

    if (!hasVideoEncoder) reasons.push("no-video-encoder");
    if (!hasAudioEncoder) reasons.push("no-audio-encoder");
    if (!hasTrackProcessor) reasons.push("no-track-processor");

    const baseVideoConfig = {
      width: 1280,
      height: 720,
      bitrate: 4_000_000,
      framerate: 30,
      bitrateMode: "constant",
      latencyMode: "realtime",
      hardwareAcceleration: "no-preference",
    } as VideoEncoderConfig;

  const audioConfig = {
    codec: "mp4a.40.2",
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  } as AudioEncoderConfig;

    const attemptSummaries: Array<{
      codec: string;
      size: string;
      knobs: string[];
      supported: boolean;
    }> = [];

    const normalizeEven = (value: number) => (value % 2 === 0 ? value : value - 1);
    const sizes = [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ];
    const codecCandidates = ["avc1.64002A", "avc1.4D401F", "avc1.42E01E"];
    const hwOptions: Array<VideoEncoderConfig["hardwareAcceleration"] | null> = [
      "prefer-hardware",
      "prefer-software",
      "no-preference",
      null,
    ];
    const ladderSteps = [
      { label: "full", omit: [] as string[] },
      { label: "no-framerate", omit: ["framerate"] },
      { label: "no-bitrateMode", omit: ["bitrateMode"] },
      { label: "no-latencyMode", omit: ["latencyMode"] },
      { label: "no-alpha", omit: ["alpha"] },
      { label: "no-bitrate", omit: ["bitrate"] },
    ];

    let selectedVideoConfig: VideoEncoderConfig | null = null;

    if (hasVideoEncoder && typeof VideoEncoder.isConfigSupported === "function") {
      for (const size of sizes) {
        const width = normalizeEven(size.width);
        const height = normalizeEven(size.height);
        for (const codec of codecCandidates) {
          for (const hw of hwOptions) {
            for (const step of ladderSteps) {
              const config: any = {
                ...baseVideoConfig,
                codec,
                width,
                height,
              };
              if (hw) {
                config.hardwareAcceleration = hw;
              } else {
                delete config.hardwareAcceleration;
              }
              for (const key of step.omit) {
                delete config[key];
              }

              let supported = false;
              try {
                const support = await VideoEncoder.isConfigSupported(config);
                supported = Boolean(support?.supported);
                if (supported) {
                  selectedVideoConfig = support?.config || config;
                }
              } catch {
                supported = false;
              }

              attemptSummaries.push({
                codec,
                size: `${width}x${height}`,
                knobs: [
                  step.label,
                  hw ? `hw:${hw}` : "hw:omit",
                  config.bitrate ? "bitrate:on" : "bitrate:omit",
                  config.framerate ? "framerate:on" : "framerate:omit",
                  config.bitrateMode ? "bitrateMode:on" : "bitrateMode:omit",
                  config.latencyMode ? "latencyMode:on" : "latencyMode:omit",
                ],
                supported,
              });

              if (supported && selectedVideoConfig) {
                details.selectedVideoConfig = selectedVideoConfig;
                details.videoConfigSupported = true;
                details.attemptedConfigCount = attemptSummaries.length;
                details.attemptSummary = attemptSummaries;
                break;
              }
            }
            if (selectedVideoConfig) break;
          }
          if (selectedVideoConfig) break;
        }
        if (selectedVideoConfig) break;
      }
    }

    if (!selectedVideoConfig) {
      details.videoConfigSupported = false;
      details.attemptedConfigCount = attemptSummaries.length;
      details.attemptSummary = attemptSummaries;
      reasons.push("video-config-unsupported");
    }

  if (hasAudioEncoder && typeof AudioEncoder.isConfigSupported === "function") {
    try {
      const support = await AudioEncoder.isConfigSupported(audioConfig);
      details.audioConfigSupported = Boolean(support?.supported);
      details.audioConfig = support?.config || audioConfig;
      if (!support?.supported) reasons.push("audio-config-unsupported");
    } catch (err) {
      details.audioConfigError = String(err);
      reasons.push("audio-config-error");
    }
  }

    const videoCodecCandidates = ["avc1.64002A", "avc1.4D401F", "avc1.42E01E"];
  const audioCodec = "mp4a.40.2";
  details.videoCodecCandidates = videoCodecCandidates;
  details.audioCodec = audioCodec;

  const playableCodecs: string[] = [];
  for (const codec of videoCodecCandidates) {
    const mp4Mime = `video/mp4; codecs="${codec}, ${audioCodec}"`;
    const canPlay = safeCanPlayType(mp4Mime);
    if (canPlay) playableCodecs.push(codec);
  }

  details.playableVideoCodecs = playableCodecs;
  details.canPlayType = playableCodecs.length > 0 ? "maybe" : "";

  const mseSupported = safeMseSupport(
    `video/mp4; codecs="${videoCodecCandidates[0]}, ${audioCodec}"`
  );
  details.mediaSourceSupported = mseSupported;

  if (playableCodecs.length === 0) {
    reasons.push("mp4-playback-unsupported");
  }

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isLinux = /Linux/i.test(ua);
  details.userAgent = ua;
  details.isLinux = isLinux;

    if (isLinux && playableCodecs.length === 0) {
      reasons.push("linux-missing-codecs");
    }

    const ok = reasons.length === 0;
    const at = Date.now();
    debugLog("probe result", { ok, reasons, details, at });

    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.probe]: { ok, reasons, details, at },
      });
    } catch {
      // ignore
    }

    return { ok, reasons, details, at };
  } catch (err: any) {
    const details = {
      message: String(err?.message || err),
      stack: err?.stack ? String(err.stack) : undefined,
    };
    const at = Date.now();
    const result = {
      ok: false,
      reasons: ["probe_exception"],
      details,
      at,
    };
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.probe]: result,
      });
    } catch {
      // ignore
    }
    return result;
  }
};

export const shouldUseFastRecorder = (
  userSetting: boolean | null | undefined,
  probeResult: FastRecorderProbeResult,
  stickyDisableState: FastRecorderStickyState
) => {
  if (userSetting === false) return false;
  if (stickyDisableState?.disabled && userSetting !== true) return false;
  return probeResult?.ok === true && Boolean(probeResult?.details?.selectedVideoConfig);
};

export const validateFastRecorderOutputBlob = async (
  blob: Blob | null,
  opts: {
    minBytes?: number;
    timeoutMs?: number;
    videoCodec?: string;
    audioCodec?: string | null;
    recordingId?: string | null;
  } = {}
): Promise<FastRecorderValidationResult> => {
  const reasons: string[] = [];
  const details: Record<string, any> = {};

  if (!blob) {
    reasons.push("no-blob");
    return { ok: false, hardFail: true, reasons, details };
  }

  const minBytes = opts.minBytes ?? 64 * 1024;
  details.size = blob.size;
  details.type = blob.type;

  if (blob.size < minBytes) {
    reasons.push("blob-too-small");
  }

  if (!blob.type || !blob.type.includes("mp4")) {
    reasons.push("unexpected-mime");
  }

  let duration = 0;
  let width = 0;
  let height = 0;
  let seekable: { start: number; end: number; length: number } | null = null;
  let frameChecked = false;
  let framePresented = false;
  let blackFrameSuspected = false;

  if (opts.recordingId) {
    details.recordingId = opts.recordingId;
  }

  if (typeof document !== "undefined") {
    const timeoutMs = opts.timeoutMs ?? 4000;
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    try {
      const meta = await new Promise<{ duration: number; width: number; height: number }>(
        (resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error("metadata-timeout"));
          }, timeoutMs);

          video.onloadedmetadata = () => {
            clearTimeout(timer);
            resolve({
              duration: Number.isFinite(video.duration) ? video.duration : video.duration || 0,
              width: video.videoWidth || 0,
              height: video.videoHeight || 0,
            });
          };

          video.onerror = () => {
            clearTimeout(timer);
            reject(new Error("metadata-error"));
          };

          video.src = url;
        }
      );

      duration = meta.duration;
      width = meta.width;
      height = meta.height;
      details.duration = duration;
      details.width = width;
      details.height = height;
      seekable = {
        length: video.seekable?.length || 0,
        start: video.seekable?.length ? video.seekable.start(0) : 0,
        end: video.seekable?.length ? video.seekable.end(0) : 0,
      };
      details.seekable = seekable;

      const durationFinite = Number.isFinite(duration) && duration > 0;
      const seekableOk = seekable && seekable.length > 0 && seekable.end > 0;

      if (!durationFinite && !seekableOk) {
        reasons.push("duration-unavailable");
      }

      // First frame validation (best-effort)
      let seekTarget = 0.1;
      if (durationFinite) {
        seekTarget = Math.min(0.1, Math.max(0.01, duration / 10));
      } else if (seekableOk) {
        seekTarget = Math.min(seekable!.end - seekable!.start, 0.1) + seekable!.start;
      }

      const seekResult = await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("seek-timeout")), timeoutMs);
        const onSeeked = () => {
          clearTimeout(timer);
          resolve();
        };
        const onError = () => {
          clearTimeout(timer);
          reject(new Error("seek-error"));
        };
        video.onseeked = onSeeked;
        video.onerror = onError;
        try {
          video.currentTime = seekTarget;
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });

      void seekResult;

      frameChecked = true;
      if (typeof video.requestVideoFrameCallback === "function") {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => resolve(), timeoutMs);
          video.requestVideoFrameCallback(() => {
            clearTimeout(timer);
            resolve();
          });
        });
        framePresented = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50));
        framePresented = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      }

      if (framePresented && width > 0 && height > 0) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(64, width);
          canvas.height = Math.min(64, height);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let bright = 0;
            for (let i = 0; i < sample.length; i += 16) {
              bright += sample[i] + sample[i + 1] + sample[i + 2];
            }
            const avg = bright / (sample.length / 16);
            blackFrameSuspected = avg < 5;
          }
        } catch {
          // ignore pixel sampling errors
        }
      }

      details.frameChecked = frameChecked;
      details.framePresented = framePresented;
      details.blackFrameSuspected = blackFrameSuspected;

      if (frameChecked && !framePresented) {
        reasons.push("frame-not-presented");
      } else if (blackFrameSuspected) {
        reasons.push("frame-black-suspected");
      }
    } catch (err) {
      details.metadataError = String(err);
      reasons.push("metadata-unavailable");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (Number.isFinite(duration) && duration <= 0) {
    reasons.push("duration-zero");
  }

  const videoCodec = opts.videoCodec || "avc1.42E01E";
  const audioCodec =
    opts.audioCodec === undefined ? "mp4a.40.2" : opts.audioCodec;
  const codecSuffix = audioCodec ? `, ${audioCodec}` : "";
  const mp4Mime = `video/mp4; codecs="${videoCodec}${codecSuffix}"`;
  const canPlay = safeCanPlayType(mp4Mime);
  const mseSupported = safeMseSupport(mp4Mime);
  details.canPlayType = canPlay;
  details.mediaSourceSupported = mseSupported;
  details.expectedVideoCodec = videoCodec;
  details.expectedAudioCodec = audioCodec;

  const metadataFailed =
    reasons.includes("metadata-unavailable") ||
    reasons.includes("duration-unavailable");

  const hardFail =
    reasons.includes("no-blob") ||
    reasons.includes("blob-too-small") ||
    reasons.includes("unexpected-mime") ||
    // When fastStart is false, metadata can be flaky in some contexts.
    // Only hard-fail metadata issues if the browser also can't play the codec.
    (metadataFailed && !canPlay);

  const ok = reasons.length === 0 || (!hardFail && Boolean(canPlay));

  debugLog("validation result", { ok, hardFail, reasons, details });

  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.validation]: {
        ok,
        hardFail,
        reasons,
        details,
        ts: Date.now(),
      },
    });
  } catch {
    // ignore
  }

  return { ok, hardFail, reasons, details };
};

export const fastRecorderStorageKeys = STORAGE_KEYS;
