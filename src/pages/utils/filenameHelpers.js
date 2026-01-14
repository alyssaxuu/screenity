export const sanitizeFilenameBase = (value) => {
  const fallback = "Screenity recording";
  if (typeof value !== "string") return fallback;

  let sanitized = value.replace(/[\u0000-\u001f\u007f]/g, "");
  sanitized = sanitized.replace(/[\\/:*?"<>|]/g, "-");
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  if (sanitized.length > 80) {
    sanitized = sanitized.slice(0, 80).trim();
  }

  return sanitized.length > 0 ? sanitized : fallback;
};

export const formatLocalTimestamp = (value) => {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  // Use Intl.DateTimeFormat to respect user locale and time format.
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(safeDate);
};

export const getHostnameFromUrl = (url) => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname || "";
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return "";
  }
};

export const getTabRecordingBaseTitle = (title, url) => {
  const candidate = title && title.trim().length > 0 ? title : getHostnameFromUrl(url);
  return sanitizeFilenameBase(candidate);
};
