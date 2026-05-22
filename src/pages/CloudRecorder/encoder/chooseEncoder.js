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

// Mirrors WebCodecsRecorder's resize-canvas math. Cloud uploaders
// and scene.{screen,camera} need encoded dims, not the source
// track's native (retina-scale on macOS while encode caps at 1080p).
// MediaRecorder records native, so callers skip this for it.
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
      container: "video/webm",
      codec: "vp9",
      hwSlots: hwSlots.summary,
      reason: "fastRecorderGate-sticky-disabled",
    };
  }
  const trackHw = hwSlots[TRACK_TO_PROBE[track]];
  if (!trackHw?.supported) {
    return {
      kind: "mediarecorder",
      container: "video/webm",
      codec: "vp9",
      hwSlots: hwSlots.summary,
      reason: `hw-probe-${track}-unsupported`,
    };
  }
  if (track === "camera" && hwSlots.summary.mode === "screen-hw-camera-mr") {
    return {
      kind: "mediarecorder",
      container: "video/webm",
      codec: "vp9",
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
  return {
    kind: "webcodecs",
    container: "video/mp4",
    codec: "avc1.4D0028",
    hwSlots: hwSlots.summary,
    cameraPreferSoftware,
    reason: cameraPreferSoftware ? "dual-webcodecs-camera-sw-mode" : "ok",
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
    return {
      ...plan,
      recorder: createMediaRecorder(stream, { mimeType }, onDataAvailable),
    };
  }

  // WebCodecs path. The MP4 mime type is always video/mp4, regardless of
  // whether audio is included (AAC fits inside MP4 alongside H.264).
  const recorder = new WebCodecsTrackRecorder(stream, {
    mimeType: "video/mp4",
    videoBitsPerSecond,
    audioBitsPerSecond,
    enableAudio,
    preferSoftware: Boolean(plan.cameraPreferSoftware),
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
    console.error(
      `[chooseEncoder] WebCodecs ${track} runtime error:`,
      err,
    );
    // Sticky-disable on hard failures, leave transient ones alone. The
    // gate's marker function distinguishes via its own pattern list.
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
