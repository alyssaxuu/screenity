// Pure rules for the teleprompter: scroll speed, saved settings, and which
// captures can safely show the floating script window.

export const FONT_SIZE_MIN = 20;
export const FONT_SIZE_MAX = 72;
export const FONT_STEP = 4;
export const WPM_MIN = 80;
export const WPM_MAX = 240;
export const WPM_STEP = 10;

export const DEFAULT_SETTINGS = {
  script: "",
  fontSize: 28,
  wpm: 120,
  autoScroll: true,
  showCamera: true,
};

const LINE_HEIGHT = 1.5;
// Average word plus space in characters, and glyph width as a fraction of font
// size. Rough on purpose: scroll speed only has to feel like the chosen pace.
const CHARS_PER_WORD = 6;
const GLYPH_WIDTH = 0.5;

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// px/s that scroll `wpm` words a minute in a `width` px block at `fontSize` px.
export const wpmToPxPerSecond = (wpm, fontSize, width) => {
  const safeWidth = Math.max(1, width || 0);
  const charsPerLine = Math.max(1, safeWidth / (fontSize * GLYPH_WIDTH));
  const wordsPerLine = Math.max(1, charsPerLine / CHARS_PER_WORD);
  const linesPerSecond = wpm / 60 / wordsPerLine;
  return linesPerSecond * fontSize * LINE_HEIGHT;
};

// Storage may hold missing, partial, older-build or hand-edited values; this
// always returns a complete, in-range object.
export const normalizeSettings = (raw) => {
  const saved = raw && typeof raw === "object" ? raw : {};
  return {
    script: typeof saved.script === "string" ? saved.script : "",
    fontSize: clamp(
      Number(saved.fontSize) || DEFAULT_SETTINGS.fontSize,
      FONT_SIZE_MIN,
      FONT_SIZE_MAX
    ),
    wpm: clamp(Number(saved.wpm) || DEFAULT_SETTINGS.wpm, WPM_MIN, WPM_MAX),
    autoScroll: saved.autoScroll !== false,
    showCamera: saved.showCamera !== false,
  };
};

// Whether the floating window can end up in the recording.
//  - "ok": tab, region and camera captures never include another window, and a
//    shared window or browser tab excludes it.
//  - "pending": screen recording, surface not picked yet.
//  - "unsafe": whole monitor (includes every window), or an unidentified surface.
// `surface` is displaySurface from the recorder ("default" until it reports).
export const prompterCaptureStatus = ({ recordingType, surface }) => {
  if (recordingType && recordingType !== "screen") return "ok";
  if (surface === "window" || surface === "browser") return "ok";
  if (surface === "monitor") return "unsafe";
  return "pending";
};

export const shouldClosePrompter = ({ recordingType, surface, recording }) => {
  const status = prompterCaptureStatus({ recordingType, surface });
  if (status === "unsafe") return true;
  return status === "pending" && Boolean(recording);
};

export const formatClock = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

// An own-track camera (cloud, subscribed, not instant) can live in the window
// for window or tab captures, which leave it out of the video. Otherwise the
// camera is burnt in and only goes in the window for full-screen, the one
// capture that records the window.
export const cameraCanLiveInWindow = ({ cloud, subscribed, instantMode }) =>
  Boolean(cloud && subscribed && !instantMode);

const CROPPED_TYPES = ["region", "tab", "camera"];

export const wantsCameraLayerAtStart = ({
  cloud,
  subscribed,
  instantMode,
  recordingType,
  cameraOn,
  windowOpen,
}) => {
  if (!cameraOn) return false;
  const own = cameraCanLiveInWindow({ cloud, subscribed, instantMode });
  // Camera beside the script only works for an own-track camera. Otherwise an
  // already-open window gets the camera only once full-screen is picked.
  if (!own && windowOpen) return false;
  if (recordingType === "screen") return true;
  return (recordingType === "region" || recordingType === "tab") && own;
};

// Whether the capture records the floating window along with the screen. A
// region or tab capture still reports displaySurface "monitor", so the
// recording type leads.
export const captureRecordsWindow = ({ recordingType, surface }) =>
  surface === "monitor" && !CROPPED_TYPES.includes(recordingType);

export const keepsCameraLayer = ({
  cloud,
  subscribed,
  instantMode,
  recordingType,
  surface,
}) => {
  if (recordingType === "camera") return false;
  const recorded = captureRecordsWindow({ recordingType, surface });
  return cameraCanLiveInWindow({ cloud, subscribed, instantMode })
    ? !recorded
    : recorded;
};

// Camera layer action once the capture is known: "open", "close", or "keep" (leave as is).
export const planCameraAtSurface = ({
  cloud,
  subscribed,
  instantMode,
  recordingType,
  surface,
  layers,
  keepVisible,
  cameraEnabled,
  windowOpen,
}) => {
  const keeps = keepsCameraLayer({
    cloud,
    subscribed,
    instantMode,
    recordingType,
    surface,
  });
  if (layers.camera) return keeps ? "keep" : "close";
  if (!keeps || !cameraEnabled || !windowOpen) return "keep";
  const own = cameraCanLiveInWindow({ cloud, subscribed, instantMode });
  // A script kept over a full-screen capture does not share the window with a burnt-in camera.
  if (!own && layers.prompter && keepVisible) return "keep";
  return "open";
};

// Pre-take, a camera-only window the capture will record closes at the start
// gate (which warns first), not at surface pick. Mid-take and during the
// countdown it closes at once.
export const cameraCloseWaitsForGate = ({
  cloud,
  subscribed,
  instantMode,
  recordingType,
  surface,
  layers,
  recording,
  countdown,
}) =>
  !recording &&
  !countdown &&
  !layers.prompter &&
  cameraCanLiveInWindow({ cloud, subscribed, instantMode }) &&
  captureRecordsWindow({ recordingType, surface });
