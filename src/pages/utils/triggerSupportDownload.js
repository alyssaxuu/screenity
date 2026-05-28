import { buildDiagnosticZip } from "./buildDiagnosticZip";

// Anchor-tag download of the diag zip; user attaches it to the Tally
// form that opens right after.
export const triggerSupportDownload = async (opts = {}) => {
  try {
    // pro users get a dedicated help form (no zip attachment); skip the
    // background zip download for them.
    const { isLoggedIn, isSubscribed } = await chrome.storage.local.get([
      "isLoggedIn",
      "isSubscribed",
    ]);
    if (isLoggedIn && isSubscribed) return null;
    const { blob, filename } = await buildDiagnosticZip(opts);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  } catch (err) {
    console.error("[Screenity] Support zip download failed:", err);
    return null;
  }
};
