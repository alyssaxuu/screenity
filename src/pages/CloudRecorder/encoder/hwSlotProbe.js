// probes HW H.264 slot availability via VideoEncoder.isConfigSupported.
// screen + camera each want a slot. Intel Quick Sync usually has 2,
// Apple Silicon many more, Linux often 0-1, VMs often 0.
// returned separately so chooseEncoder can fall the camera back to
// MediaRecorder/VP9 when only the screen slot is free (mixing HW H.264
// for screen + SW H.264 for camera trashes the main thread).

// Probe at a conservative bitrate baseline (4 Mbps). The real encoder
// runs later at the desired bitrate; isConfigSupported gates codec /
// profile / dimensions / HW availability, and some HW reports false on
// aggressive bitrates that it actually handles fine in practice.
const PROBE_BITRATE = 4_000_000;

// Codec candidates ordered by preference. Trying multiple lets the probe
// succeed on machines where the highest profile isn't supported but a
// lower one (e.g. Baseline L3.0) is. Mirrors fastRecorderGate's approach.
//   avc1.64002A = High Profile L4.2 (up to 1080p high bitrate)
//   avc1.4D0028 = Main L4.0 (up to 1080p)
//   avc1.4D401F = Main L3.1 (up to 720p high bitrate)
//   avc1.42E01E = Baseline L3.0 (universal compatibility)
const CODEC_CANDIDATES = [
  "avc1.64002A",
  "avc1.4D0028",
  "avc1.4D401F",
  "avc1.42E01E",
];

const HW_OPTIONS = ["prefer-hardware", "no-preference"];

const buildVideoConfig = ({ codec, width, height, framerate, hwOption }) => ({
  codec,
  width,
  height,
  bitrate: PROBE_BITRATE,
  framerate,
  bitrateMode: "constant",
  latencyMode: "realtime",
  hardwareAcceleration: hwOption,
});

// Try (codec × hw-option) combinations until one reports supported. A
// machine that supports plain H.264 software but not hardware still gets
// WebCodecs (better encoder reliability than MediaRecorder VP9, which is
// also software). The "all-mr" fallback only triggers when every codec
// + hw option fails.
const probeOne = async (label, { width, height, framerate }) => {
  if (typeof VideoEncoder === "undefined") {
    return { label, supported: false, reason: "VideoEncoder unavailable" };
  }
  const attempts = [];
  for (const codec of CODEC_CANDIDATES) {
    for (const hwOption of HW_OPTIONS) {
      const config = buildVideoConfig({
        codec,
        width,
        height,
        framerate,
        hwOption,
      });
      try {
        const result = await VideoEncoder.isConfigSupported(config);
        attempts.push({
          codec,
          hwOption,
          supported: Boolean(result?.supported),
        });
        if (result?.supported) {
          return {
            label,
            supported: true,
            configResolved: result.config || config,
            attempts,
          };
        }
      } catch (err) {
        attempts.push({
          codec,
          hwOption,
          supported: false,
          error: String(err?.message || err),
        });
      }
    }
  }
  return { label, supported: false, attempts };
};

export const probeHwSlots = async ({
  framerate = 30,
} = {}) => {
  // Probe at a universal 720p baseline regardless of the actual stream
  // dimensions. isConfigSupported is a feasibility check for this codec
  // family on this hardware. modern HW that can encode 720p H.264
  // can encode any resolution we'd realistically capture (Bunny caps at
  // 1080p tier anyway). Probing at the actual resolution is risky:
  // getSettings() can return inaccurate values during track warmup, and
  // some Chromium builds (Playwright's headless variant) reject 1080p
  // configs even though the real encoder handles them once started.
  const screenProbe = await probeOne("screen", {
    width: 1280,
    height: 720,
    framerate,
  });
  const cameraProbe = await probeOne("camera", {
    width: 1280,
    height: 720,
    framerate,
  });
  return {
    screen: screenProbe,
    camera: cameraProbe,
    summary: {
      screenHw: screenProbe.supported,
      cameraHw: cameraProbe.supported,
      // Both supported = dual-hw. Only screen = degrade camera. Neither
      // (or only camera, which we don't optimize for) = all-mr.
      mode: screenProbe.supported
        ? cameraProbe.supported
          ? "dual-hw"
          : "screen-hw-camera-mr"
        : "all-mr",
    },
  };
};
