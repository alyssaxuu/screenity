// picks WebCodecs (H.264 fMP4) when the HW probe + fastRecorderGate
// sticky state allow, otherwise falls back to MediaRecorder (VP9-WebM).
// chooseTrackEncoder returns either a real MediaRecorder (built by the
// caller's factory) or a WebCodecsTrackRecorder; both expose the same
// MediaRecorder-shaped surface CloudRecorder uses.

import {
  getFastRecorderStickyState,
  markFastRecorderFailure,
} from "../../../media/fastRecorderGate";
import { WebCodecsTrackRecorder } from "./WebCodecsTrackRecorder";
import { probeHwSlots } from "./hwSlotProbe";
import { canStartMp4Recorder } from "../../utils/recorderCodec";

// Prefer H.264/MP4 fallback (Chrome/Edge 126+, not Firefox); VP9-WebM breaks
// downstream (Bunny drops frames, node-av SIGSEGVs). false = VP9-WebM.
const PREFER_MP4_MEDIARECORDER = true;

// MediaRecorder's audio-only WebM carries no Duration, so players report
// Infinity. false = WebM/Opus.
const PREFER_MP4_AUDIO_MEDIARECORDER = true;

// H.264 Baseline + AAC-LC. Video-only variant for audioless tracks;
// isTypeSupported answers differently for the two, so probe both.
const MP4_MR_WITH_AUDIO = "video/mp4;codecs=avc1.42E01E,mp4a.40.2";
const MP4_MR_VIDEO_ONLY = "video/mp4;codecs=avc1.42E01E";
// AAC-LC, audio-only. Pinned: a bare audio/mp4 records Opus-in-MP4 on
// Chrome 151.
const MP4_MR_AUDIO_ONLY = "audio/mp4;codecs=mp4a.40.2";
// Separated mics go to Bunny Storage, whose audio MIME allowlist takes
// audio/webm and rejects video/webm.
const WEBM_MR_AUDIO_ONLY = "audio/webm;codecs=opus";

const mimeSupported = (mime) => {
  try {
    return (
      typeof MediaRecorder !== "undefined" &&
      typeof MediaRecorder.isTypeSupported === "function" &&
      MediaRecorder.isTypeSupported(mime)
    );
  } catch {
    return false;
  }
};

let _mp4MrSupport = null;
const probeMp4MediaRecorder = () => {
  if (_mp4MrSupport !== null) return _mp4MrSupport;
  _mp4MrSupport = PREFER_MP4_MEDIARECORDER
    ? {
        withAudio: mimeSupported(MP4_MR_WITH_AUDIO),
        videoOnly: mimeSupported(MP4_MR_VIDEO_ONLY),
      }
    : { withAudio: false, videoOnly: false };
  return _mp4MrSupport;
};

let _mp4AudioMrSupport = null;
// TUS filetype is fixed at uploader init, so an MP4 start() that throws later
// ships WebM bytes labelled audio/mp4. Probe the real mic stream here.
const probeMp4AudioMediaRecorder = (stream = null) => {
  if (_mp4AudioMrSupport !== null) return _mp4AudioMrSupport;
  const typeOk =
    PREFER_MP4_AUDIO_MEDIARECORDER && mimeSupported(MP4_MR_AUDIO_ONLY);
  if (!typeOk) {
    _mp4AudioMrSupport = false;
    return false;
  }
  // No stream yet: report support without caching, so the first call that has
  // one still gets to run the start probe.
  if (!stream) return true;
  _mp4AudioMrSupport = canStartMp4Recorder(stream, MP4_MR_AUDIO_ONLY);
  return _mp4AudioMrSupport;
};

// Only claim MP4 when both variants record: the container is fixed before we
// know whether this track carries audio.
const mediaRecorderVideoPlan = () => {
  const s = probeMp4MediaRecorder();
  return s.withAudio && s.videoOnly
    ? { container: "video/mp4", codec: "avc1.42E01E" }
    : { container: "video/webm", codec: "vp9" };
};

// Null for WebM: callers pass their existing mime through unchanged.
export const mediaRecorderMimeFor = ({ container, enableAudio }) => {
  if (container === "audio/mp4") return MP4_MR_AUDIO_ONLY;
  if (container === "audio/webm") return WEBM_MR_AUDIO_ONLY;
  if (container !== "video/mp4") return null;
  return enableAudio ? MP4_MR_WITH_AUDIO : MP4_MR_VIDEO_ONLY;
};

// Encoded dims (capped at 1080p), not source-native. WebCodecs only;
// MediaRecorder records native, so it skips this.
export const WEBCODECS_CAP_WIDTH = 1920;
export const WEBCODECS_CAP_HEIGHT = 1080;
const HARD_CAP = 3840;

export const computeEncodedDimensions = ({
  width,
  height,
  capWidth = WEBCODECS_CAP_WIDTH,
  capHeight = WEBCODECS_CAP_HEIGHT,
}) => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { width: 0, height: 0 };
  }
  const effectiveCapWidth = Math.min(capWidth, HARD_CAP);
  const effectiveCapHeight = Math.min(capHeight, HARD_CAP);
  let targetWidth = Math.min(width, effectiveCapWidth);
  let targetHeight = Math.round((height / width) * targetWidth);
  if (targetHeight > effectiveCapHeight) {
    targetHeight = effectiveCapHeight;
    targetWidth = Math.round((width / height) * targetHeight);
  }
  // H.264 requires even dimensions; min 32 for tiny regions.
  targetWidth = Math.max(32, targetWidth - (targetWidth % 2));
  targetHeight = Math.max(32, targetHeight - (targetHeight % 2));
  return { width: targetWidth, height: targetHeight };
};

// Webcam noise is incompressible, so a 640x480 camera took the flat 16 Mbps
// target at its word: 13 Mbps, 1.4 bpp against 0.1-0.2 for good 480p H.264.
const CAMERA_BITRATE_RUNGS = [
  { maxPixels: 854 * 480, bitrate: 2_000_000 },
  { maxPixels: 1280 * 720, bitrate: 4_000_000 },
];
// The web recorder uses the same ladder. Keep both sides in step.
const CAMERA_BITRATE_MAX = 6_000_000;

// Takes ENCODED dims, not captured. computeEncodedDimensions caps the camera
// at 1920x1080, so the top rung also answers unknown dimensions.
export const computeCameraBitrate = ({ width, height } = {}) => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return CAMERA_BITRATE_MAX;
  }
  const pixels = width * height;
  const rung = CAMERA_BITRATE_RUNGS.find((r) => pixels <= r.maxPixels);
  return rung ? rung.bitrate : CAMERA_BITRATE_MAX;
};

// memoize per-session: chooseTrackEncoder() runs once per track during
// start, so the probe fires three times back-to-back without this cache.
let _hwSlotsPromise = null;
let _stickyStatePromise = null;

export const resetEncoderProbeCache = () => {
  _hwSlotsPromise = null;
  _stickyStatePromise = null;
  _mp4AudioMrSupport = null;
};

const ensureProbes = async (probeOptions) => {
  if (!_hwSlotsPromise) {
    _hwSlotsPromise = probeHwSlots(probeOptions);
  }
  if (!_stickyStatePromise) {
    _stickyStatePromise = getFastRecorderStickyState();
  }
  return Promise.all([_hwSlotsPromise, _stickyStatePromise]);
};

const TRACK_TO_PROBE = {
  screen: "screen",
  camera: "camera",
  // Audio always uses MediaRecorder; chooseTrackEncoder short-circuits
  // before consulting probes.
};

// Returns the encoder decision (kind / container / codec) without
// constructing a recorder. Used by initializeUploaders so the
// BunnyTusUploader's TUS Upload-Metadata `filetype` can be set to the
// container the upcoming recorder will produce. Both inspectTrackPlan
// and chooseTrackEncoder hit the same probe cache, so they always agree.
export const inspectTrackPlan = async ({
  track,
  probeOptions,
  stream = null,
  separated = false,
}) => {
  // Audio never uses WebCodecs: screen + camera already contend for the
  // H.264 slots. MP4 here is a muxer swap inside MediaRecorder, not an encoder.
  if (track === "audio") {
    const mp4 = probeMp4AudioMediaRecorder(stream);
    // Storage's audio MIME allowlist rejects video/webm and discards the take
    // with no user-facing error, so a separated mic reaches it only on a build
    // supporting neither audio container.
    const webmContainer = !separated
      ? // Muxed tracks have always uploaded under video/webm.
        "video/webm"
      : mimeSupported(WEBM_MR_AUDIO_ONLY)
      ? "audio/webm"
      : mimeSupported(MP4_MR_AUDIO_ONLY)
      ? "audio/mp4"
      : "video/webm";
    return {
      kind: "mediarecorder",
      container: mp4 ? "audio/mp4" : webmContainer,
      codec: mp4 ? "mp4a.40.2" : "opus",
      hwSlots: null,
      reason: mp4
        ? "audio-track-mp4"
        : webmContainer === "audio/webm"
        ? "audio-track-audio-webm"
        : "audio-track-webm",
    };
  }
  const [hwSlots, sticky] = await ensureProbes(probeOptions || {});
  if (sticky?.disabled) {
    return {
      kind: "mediarecorder",
      ...mediaRecorderVideoPlan(),
      hwSlots: hwSlots.summary,
      reason: "fastRecorderGate-sticky-disabled",
    };
  }
  const trackHw = hwSlots[TRACK_TO_PROBE[track]];
  if (!trackHw?.supported) {
    return {
      kind: "mediarecorder",
      ...mediaRecorderVideoPlan(),
      hwSlots: hwSlots.summary,
      reason: `hw-probe-${track}-unsupported`,
    };
  }
  // Linux Chromium has no AAC, so MP4 would be silent. WebM/Opus, not
  // MediaRecorder, whose VFR output jitters on render.
  // `=== false` so an older cached probe without the field fails open.
  if (hwSlots.summary.aacSupported === false) {
    return {
      kind: "webcodecs",
      container: "video/webm",
      containerKind: "webm",
      codec: "vp9",
      hwSlots: hwSlots.summary,
      reason: "aac-unsupported-webm",
    };
  }
  if (track === "camera" && hwSlots.summary.mode === "screen-hw-camera-mr") {
    return {
      kind: "mediarecorder",
      ...mediaRecorderVideoPlan(),
      hwSlots: hwSlots.summary,
      reason: "screen-hw-camera-mr-mode",
    };
  }
  // Camera on WebCodecs but with software encoder so it doesn't fight
  // the screen's HW slot. Same MP4 h264 container as the dual-hw mode,
  // just a different backend selection inside WebCodecsRecorder.
  const cameraPreferSoftware =
    track === "camera" &&
    hwSlots.summary.mode === "dual-webcodecs-camera-sw";
  // HW encoder failed the output-liveness probe: use software H.264 (same MP4)
  // rather than risk a silent zero-chunk recording. Off until the probe ships.
  const screenPreferSoftware =
    track === "screen" && Boolean(hwSlots.summary.screenPreferSoftware);
  return {
    kind: "webcodecs",
    container: "video/mp4",
    // Container/codec hint for Bunny's TUS Upload-Metadata. The real codec
    // is picked at configure time by chooseVideoEncoderConfig.
    codec: "avc1.64002A",
    hwSlots: hwSlots.summary,
    cameraPreferSoftware,
    screenPreferSoftware,
    reason: cameraPreferSoftware
      ? "dual-webcodecs-camera-sw-mode"
      : screenPreferSoftware
        ? "screen-hw-no-output-sw"
        : "ok",
  };
};

export const chooseTrackEncoder = async ({
  track,
  stream,
  separated = false,
  mimeType,
  videoBitsPerSecond,
  audioBitsPerSecond,
  audioChannels,
  enableAudio,
  createMediaRecorder,
  onDataAvailable,
  onRecorderError,
  probeOptions,
  maxWidth,
  maxHeight,
  fps,
}) => {
  const plan = await inspectTrackPlan({ track, probeOptions, stream, separated });

  if (plan.kind === "mediarecorder") {
    // Use the plan's mime so bytes match the container we already reported (TUS
    // filetype / editor blob type). Null = WebM: pass the caller's mime unchanged.
    let planMime = mediaRecorderMimeFor({
      container: plan.container,
      enableAudio,
    });
    // isTypeSupported can advertise MP4 on boxes whose MediaRecorder throws from
    // start(). Probe the real stream and fall back to WebM rather than lose the
    // recording; plan.container follows so the reported filetype stays truthful.
    if (planMime && !canStartMp4Recorder(stream, planMime)) {
      // A separated mic can't fall back to video/webm; Storage would reject it.
      const audioWebm =
        track === "audio" && separated && mimeSupported(WEBM_MR_AUDIO_ONLY);
      planMime = audioWebm ? WEBM_MR_AUDIO_ONLY : null;
      plan.container = audioWebm ? "audio/webm" : "video/webm";
      plan.codec = track === "audio" ? "opus" : "vp9";
      plan.reason = `${plan.reason}+mp4-start-probe-failed`;
    }
    return {
      ...plan,
      recorder: createMediaRecorder(
        stream,
        { mimeType: planMime || mimeType },
        onDataAvailable,
        track,
      ),
    };
  }

  // WebCodecs path: MP4 stays video/mp4 with or without audio. WebM is the
  // no-AAC fallback, carrying VP9 + Opus instead.
  // forceSoftwareEncoder storage flag biases the encoder candidate list
  // toward prefer-software. Playwright Chromium 1217 hits a documented
  // "encode() accepts, no chunks emit" HW silent-fail (see Windows MFT
  // note in WebCodecsRecorder.js:chooseVideoEncoderConfig) on macOS
  // auto-select-desktop-capture streams; SW H.264 encodes them cleanly.
  let forceSoftware = false;
  try {
    const s = await chrome.storage.local.get(["forceSoftwareEncoder"]);
    forceSoftware = Boolean(s.forceSoftwareEncoder);
  } catch {}
  const containerKind = plan.containerKind === "webm" ? "webm" : "mp4";
  const recorder = new WebCodecsTrackRecorder(stream, {
    mimeType: containerKind === "webm" ? "video/webm" : "video/mp4",
    containerKind,
    videoBitsPerSecond,
    audioBitsPerSecond,
    audioChannels,
    enableAudio,
    preferSoftware:
      forceSoftware ||
      Boolean(plan.cameraPreferSoftware) ||
      Boolean(plan.screenPreferSoftware),
    trackKind: track,
    maxWidth,
    maxHeight,
    fps,
  });
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      const maybe = onDataAvailable(event.data);
      if (maybe && typeof maybe.then === "function") {
        recorder._pendingWrites.add(maybe);
        const settle = () => recorder._pendingWrites.delete(maybe);
        maybe.then(settle, (err) => {
          settle();
          console.warn(
            "[chooseEncoder] WebCodecs ondataavailable failed:",
            err,
          );
        });
      }
    }
  };
  recorder.onerror = (event) => {
    const err = event?.error;
    // Salvage stop() already ran; don't sticky-disable or double-report.
    if (err && err.finalized === true) {
      return;
    }
    console.error(
      `[chooseEncoder] WebCodecs ${track} runtime error:`,
      err,
    );
    try {
      onRecorderError?.(err, track);
    } catch {}
    // Pro marks failures per-session (in-memory) instead of persisting
    // useWebCodecsRecorder=false; fresh HW probes run each session.
    void markFastRecorderFailure(`cloud-${track}-runtime`, {
      error: String(err?.message || err),
      detail: err?.detail || null,
      track,
    });
  };

  return {
    ...plan,
    recorder,
  };
};
