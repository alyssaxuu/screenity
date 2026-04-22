import { tryResumePendingUploads } from "../recording/resumePendingUploads";

// For some reason without this the service worker doesn't always work
export const onStartupListener = async () => {
  chrome.runtime.onStartup.addListener(() => {
    if (globalThis.SCREENITY_VERBOSE_LOGS) {
      console.log("Service worker started up successfully.");
    }
    setTimeout(() => {
      tryResumePendingUploads({ trigger: "onStartup" }).catch(() => {});
    }, 5000);
  });
};
