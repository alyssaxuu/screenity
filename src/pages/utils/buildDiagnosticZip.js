/**
 * Shared helper that builds the diagnostic ZIP blob used by both:
 *   - popup Settings Menu ("Download data for troubleshooting")
 *   - Sandbox/Editor RightPanel ("Get help with your recording")
 *
 * Returns { blob, filename } so the caller can decide how to trigger the download
 * (content script uses <a>.click(), sandbox uses chrome.downloads.download).
 *
 * @param {Object} [options]
 * @param {Object} [options.extraConfig] — caller-specific config fields merged into config.json
 * @param {string} [options.source]      — label for which entry point triggered the export
 */
import JSZip from "jszip";

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

  // sessions.json — diagnostic session timeline
  if (diagData?.log) {
    zip.file("sessions.json", JSON.stringify(diagData.log));
  }

  // errors.json — consolidated error-state keys
  if (diagData?.errors) {
    zip.file("errors.json", JSON.stringify(diagData.errors));
  }

  // storage-flags.json — current boolean/numeric state flags
  if (diagData?.flags) {
    zip.file("storage-flags.json", JSON.stringify(diagData.flags));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `screenity-diagnostics-${ts}.zip`;

  return { blob, filename };
};
