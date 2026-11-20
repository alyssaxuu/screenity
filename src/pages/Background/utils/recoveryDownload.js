// Saves a blob URL the offscreen host made, since that document has no chrome.downloads.
const RECORDER_PAGES = ["offscreenrecorder.html", "cloudrecorder.html"];

// Only this extension's own recorder pages may ask for a download.
const fromRecorderPage = (sender) => {
  if (sender?.id !== chrome.runtime.id || typeof sender?.url !== "string") {
    return false;
  }
  const path = sender.url.split(/[?#]/)[0];
  return RECORDER_PAGES.some((page) => path === chrome.runtime.getURL(page));
};

export const startRecoveryDownload = async ({ url, filename } = {}, sender) => {
  if (!fromRecorderPage(sender)) return { ok: false, error: "bad-sender" };
  if (typeof url !== "string" || !url.startsWith("blob:") || !filename) {
    return { ok: false, error: "bad-request" };
  }
  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename,
      saveAs: false,
    });
    return { ok: true, downloadId };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
};
