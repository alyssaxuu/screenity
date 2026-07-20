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

// H.264 Baseline + AAC-LC. Video-only variant for audioless tracks;
// isTypeSupported answers differently for the two, so probe both.
const MP4_MR_WITH_AUDIO = "video/mp4;codecs=avc1.42E01E,mp4a.40.2";
const MP4_MR_VIDEO_ONLY = "video/mp4;codecs=avc1.42E01E";

let _mp4MrSupport = null;
const probeMp4MediaRecorder = () => {
  if (_mp4MrSupport !== null) return _mp4MrSupport;
  const supported = (mime) => {
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
  _mp4MrSupport = PREFER_MP4_MEDIARECORDER
    ? {
        withAudio: supported(MP4_MR_WITH_AUDIO),
        videoOnly: supported(MP4_MR_VIDEO_ONLY),
      }
    : { withAudio: false, videoOnly: false };
  return _mp4MrSupport;
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

// memoize per-session: chooseTrackEncoder() runs once per track during
// start, so the probe fires three times back-to-back without this cache.
let _hwSlotsPromise = null;
let _stickyStatePromise = null;

export const resetEncoderProbeCache = () => {
  _hwSlotsPromise = null;
  _stickyStatePromise = null;
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
export const inspectTrackPlan = async ({ track, probeOptions }) => {
  if (track === "audio") {
    return {
      kind: "mediarecorder",
      container: "video/webm",
      codec: "opus",
      hwSlots: null,
      reason: "audio-track-fixed",
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
  // MP4/WebCodecs can't carry audio without AAC. When AAC encode is missing
  // (rare: Chromium with H.264 but no proprietary AAC) the WebCodecs path
  // would produce a silent MP4, so route video tracks to MediaRecorder
  // (VP9-WebM), which records audio natively. AAC support is device-global, so
  // both inspectTrackPlan callers (TUS filetype hint and recorder) agree.
  // `=== false` so an older cached probe without the field fails open.
  if (hwSlots.summary.aacSupported === false) {
    return {
      kind: "mediarecorder",
      ...mediaRecorderVideoPlan(),
      hwSlots: hwSlots.summary,
      reason: "aac-unsupported",
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
  mimeType,
  videoBitsPerSecond,
  audioBitsPerSecond,
  enableAudio,
  createMediaRecorder,
  onDataAvailable,
  probeOptions,
}) => {
  const plan = await inspectTrackPlan({ track, probeOptions });

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
      planMime = null;
      plan.container = "video/webm";
      plan.codec = "vp9";
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

  // WebCodecs path. The MP4 mime type is always video/mp4, regardless of
  // whether audio is included (AAC fits inside MP4 alongside H.264).
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
  const recorder = new WebCodecsTrackRecorder(stream, {
    mimeType: "video/mp4",
    videoBitsPerSecond,
    audioBitsPerSecond,
    enableAudio,
    preferSoftware:
      forceSoftware ||
      Boolean(plan.cameraPreferSoftware) ||
      Boolean(plan.screenPreferSoftware),
    trackKind: track,
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
