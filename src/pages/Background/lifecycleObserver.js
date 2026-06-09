// watches chrome.storage.local for transitions on a fixed set of
// recording-state keys and logs them to lifecycleLog so we don't have
// to instrument each BG call site. wired once at SW startup.
import { lifecycle } from "../utils/lifecycleLog";

// Keys whose transitions we care about for cross-recording bug analysis.
// `lifecycleLog` itself is excluded to avoid infinite recursion.
const TRACKED_KEYS = new Set([
  "recordingTab",
  "recordingUiTabId",
  "tabRecordedID",
  "sandboxTab",
  "recording",
  "pendingRecording",
  "restarting",
  "offscreen",
  "region",
  "customRegion",
  "recordingType",
  "useWebCodecsRecorder",
  "fastRecorderInUse",
  "fastRecorderDisabledForDevice",
  "memoryError",
  "lastRecordingBackendRef",
  "editorRecordingError",
]);

const summarizeValue = (v) => {
  if (v === null || v === undefined) return v;
  if (typeof v === "object") {
    try {
      const json = JSON.stringify(v);
      return json.length > 120 ? json.slice(0, 117) + "..." : v;
    } catch {
      return "[unserializable]";
    }
  }
  return v;
};

export const initLifecycleObserver = () => {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of Object.keys(changes)) {
      if (!TRACKED_KEYS.has(key)) continue;
      const { oldValue, newValue } = changes[key];
      // Skip no-op writes (same value).
      if (oldValue === newValue) continue;
      lifecycle("BG.storage", "set", {
        key,
        from: summarizeValue(oldValue),
        to: summarizeValue(newValue),
      });
    }

    // Reactive icon sync. Anchors the action icon to storage.recording
    // so it can never drift out of sync when an imperative
    // chrome.action.setIcon call is missed (e.g. a stop path
    // interrupted by SW teardown). Imperative setIcon calls in the
    // start/stop sites still run; this is the safety net.
    if (changes.recording && changes.recording.oldValue !== changes.recording.newValue) {
      try {
        chrome.action.setIcon({
          path: changes.recording.newValue
            ? "assets/recording-logo.png"
            : "assets/icon-34.png",
        });
      } catch (err) {
        console.warn("[Screenity][BG] reactive setIcon failed:", err);
      }
    }
  });
};
