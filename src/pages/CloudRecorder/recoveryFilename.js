// chrome.downloads.download rejects ':' and other Windows-forbidden characters with "Invalid filename",
// so an ISO timestamp or free-form reason in the name fails the whole recovery download.
const RESERVED = /[<>:"/\\|?*\u0000-\u001f]/g;

export const safeFilenamePart = (value) =>
  String(value ?? "")
    .replace(RESERVED, "-")
    .replace(/\s+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

export const recoveryFilename = ({ prefix, reason, ext, now = new Date() }) => {
  const stamp = safeFilenamePart(now.toISOString().replace(/\.\d+Z$/, "Z"));
  const parts = [prefix, stamp, safeFilenamePart(reason).slice(0, 60)].filter(
    Boolean
  );
  return `${parts.join("-")}.${ext}`;
};
