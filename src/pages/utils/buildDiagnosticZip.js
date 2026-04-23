/**
 * Builds a diagnostic ZIP for troubleshooting. Returns { blob, filename }.
 * Used by the popup settings menu and the editor "Get help" button.
 */
import JSZip from "jszip";
import { getStartFlowTrace } from "./startFlowTrace";

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
];

export const buildDiagnosticZip = async ({
  extraConfig = {},
  source = "unknown",
} = {}) => {
  const userAgent = navigator.userAgent;

  // Parallel fetches from background
  const [platformInfo, diagData, fastRecorderData] = await Promise.all([
    chrome.runtime.sendMessage({ type: "get-platform-info" }),
    chrome.runtime.sendMessage({ type: "get-diagnostic-log" }),
    new Promise((resolve) =>
      chrome.storage.local.get(FAST_RECORDER_KEYS, resolve),
    ),
  ]);

  const manifestVersion = chrome.runtime.getManifest().version;
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const zip = new JSZip();

  // manifest.json — export metadata
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

  // environment.json
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

  // config.json — recording settings + caller-specific extras
  zip.file(
    "config.json",
    JSON.stringify({
      fastRecorder: fastRecorderData,
      ...extraConfig,
    }),
  );

  // sessions.json — diagnostic session timeline with derived hints
  if (diagData?.log) {
    const annotated = JSON.parse(JSON.stringify(diagData.log));
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
    zip.file("sessions.json", JSON.stringify(annotated));
  }

  // errors.json — consolidated error-state keys
  if (diagData?.errors) {
    zip.file("errors.json", JSON.stringify(diagData.errors));
  }

  // storage-flags.json — current boolean/numeric state flags
  if (diagData?.flags) {
    zip.file("storage-flags.json", JSON.stringify(diagData.flags));
  }

  // start-flow-trace.json
  try {
    const trace = await getStartFlowTrace();
    if (trace) {
      zip.file("start-flow-trace.json", JSON.stringify(trace));
    }
  } catch {
    // best effort
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `screenity-diagnostics-${ts}.zip`;

  return { blob, filename };
};
