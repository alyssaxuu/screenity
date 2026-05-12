import { buildDiagnosticZip } from "./buildDiagnosticZip";

// Anchor-tag download of the diag zip so the user can attach it to the
// Tally form that opens right after. Fire-and-forget.
export const triggerSupportDownload = async (opts = {}) => {
  try {
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
