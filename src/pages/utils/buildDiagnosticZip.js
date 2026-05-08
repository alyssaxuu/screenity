/**
 * Builds a diagnostic ZIP for troubleshooting. Returns { blob, filename }.
 * Used by the popup settings menu and the editor "Get help" button.
 */
import JSZip from "jszip";
import { getStartFlowTrace } from "./startFlowTrace";

// Last line of defense before the diag zip leaves the user's machine:
// strip user-home paths and URL query strings/fragments (recording IDs,
// signed-URL tokens, OAuth tokens).
const PII_REPLACEMENTS = [
  [/\/Users\/[^/\s"]+/g, "/Users/[redacted]"],
  [/\/home\/[^/\s"]+/g, "/home/[redacted]"],
  [/[A-Z]:\\Users\\[^\\\s"]+/g, "C:\\Users\\[redacted]"],
  [/(https?:\/\/[^\s?#"'<>]+)\?[^\s#"'<>]*/g, "$1?[query-redacted]"],
  [/(https?:\/\/[^\s#"'<>]+)#[^\s"'<>]*/g, "$1#[fragment-redacted]"],
  [/(chrome-extension:\/\/[^\s?#"'<>]+)\?[^\s#"'<>]*/g, "$1?[query-redacted]"],
  [/(chrome-extension:\/\/[^\s#"'<>]+)#[^\s"'<>]*/g, "$1#[fragment-redacted]"],
];

const redactString = (s) => {
  let out = s;
  for (const [pat, repl] of PII_REPLACEMENTS) {
    out = out.replace(pat, repl);
  }
  return out;
};

const redactPii = (value, depth = 0) => {
  if (depth > 12) return value;
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redactPii(v, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactPii(v, depth + 1);
    }
    return out;
  }
  return value;
};

const FAST_RECORDER_KEYS = [
  "fastRecorderBeta",
  "fastRecorderDecision",
  "fastRecorderDisabledForDevice",
  "fastRecorderDisabledReason",
  "fastRecorderDisabledDetails",
  "fastRecorderDisabledAt",
  "fastRecorderProbe",
  "fastRecorderValidation",
  "fastRecorderValidationFailed",
  "fastRecorderInUse",
  "fastRecorderSelectedEncoder",
  "useWebCodecsRecorder",
  "lastWebCodecsFailureAt",
  "lastWebCodecsFailureCode",
  "lastFailedValidation",
  "webcodecsConstructSnapshot",
  "recorderStartTimings",
  "countdownFinishedAt",
  "lastStartRecordingCaller",
  "lastCountdownFinishedDecision",
  "lastStartAfterCountdown",
];

export const buildDiagnosticZip = async ({
  extraConfig = {},
  source = "unknown",
} = {}) => {
  const userAgent = navigator.userAgent;

  const [
    platformInfo,
    diagData,
    fastRecorderData,
    lifecycleData,
    perfTimeline,
    uploadTelemetry,
  ] = await Promise.all([
      chrome.runtime.sendMessage({ type: "get-platform-info" }),
      chrome.runtime.sendMessage({ type: "get-diagnostic-log" }),
      new Promise((resolve) =>
        chrome.storage.local.get(FAST_RECORDER_KEYS, resolve),
      ),
      new Promise((resolve) =>
        chrome.storage.local.get(["lifecycleLog"], (r) =>
          resolve(Array.isArray(r?.lifecycleLog) ? r.lifecycleLog : []),
        ),
      ),
      new Promise((resolve) =>
        // perfMarks writes per-context (perfTimeline.BG, etc) to avoid
        // write races; read all and merge by timestamp.
        chrome.storage.local.get(null, (all) => {
          const merged = [];
          for (const k of Object.keys(all || {})) {
            if (k === "perfTimeline" || k.startsWith("perfTimeline.")) {
              const arr = all[k];
              if (Array.isArray(arr)) merged.push(...arr);
            }
          }
          merged.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
          resolve(merged);
        }),
      ),
      new Promise((resolve) =>
        // CloudRecorder writes locally before posting; captures state when offline.
        chrome.storage.local.get(["cloudUploadTelemetryEvents"], (r) =>
          resolve(
            Array.isArray(r?.cloudUploadTelemetryEvents)
              ? r.cloudUploadTelemetryEvents
              : [],
          ),
        ),
      ),
    ]);

  const manifestVersion = chrome.runtime.getManifest().version;
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const zip = new JSZip();

  zip.file(
    "manifest.json",
    JSON.stringify({
      extensionVersion: manifestVersion,
      schemaVersion: 1,
      exportedAt: now.toISOString(),
      chromeVersion: /Chrome\/([\d.]+)/.exec(userAgent)?.[1] || null,
      source,
    }),
  );

  zip.file(
    "environment.json",
    JSON.stringify({
      userAgent,
      platformInfo,
      screen: {
        width: window.screen.availWidth,
        height: window.screen.availHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      deviceMemory: navigator.deviceMemory || null,
    }),
  );

  zip.file(
    "config.json",
    JSON.stringify({
      fastRecorder: fastRecorderData,
      ...extraConfig,
    }),
  );

  if (diagData?.log) {
    // structuredClone avoids the stringification round-trip on large logs.
    const annotated =
      typeof structuredClone === "function"
        ? structuredClone(diagData.log)
        : JSON.parse(JSON.stringify(diagData.log));
    if (annotated.sessions) {
      for (const session of annotated.sessions) {
        if (!session.events?.length) continue;
        const hints = [];
        const hasEditorOpen = session.events.some(
          (ev) => ev.e === "editor-open" && ev.d?.type === "editorwebcodecs",
        );
        const hasEditorReady = session.events.some(
          (ev) => ev.e === "editor-load-ready",
        );
        if (hasEditorOpen && !hasEditorReady) {
          hints.push("Editor handoff incomplete: editor opened but never finished loading");
        }
        if (hints.length > 0) session.hints = hints;
      }
    }
    zip.file("sessions.json", JSON.stringify(redactPii(annotated)));
  }

  if (diagData?.errors) {
    zip.file("errors.json", JSON.stringify(redactPii(diagData.errors)));
  }

  if (diagData?.flags) {
    zip.file("storage-flags.json", JSON.stringify(redactPii(diagData.flags)));
  }

  try {
    const trace = await getStartFlowTrace();
    if (trace) {
      zip.file("start-flow-trace.json", JSON.stringify(trace));
    }
  } catch {}

  if (Array.isArray(lifecycleData) && lifecycleData.length > 0) {
    zip.file("lifecycle-log.json", JSON.stringify(lifecycleData));
  }

  if (Array.isArray(perfTimeline) && perfTimeline.length > 0) {
    zip.file("perf-timeline.json", JSON.stringify(perfTimeline));
  }

  if (Array.isArray(uploadTelemetry) && uploadTelemetry.length > 0) {
    zip.file(
      "upload-telemetry.json",
      JSON.stringify(redactPii(uploadTelemetry)),
    );
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `screenity-diagnostics-${ts}.zip`;

  return { blob, filename };
};
