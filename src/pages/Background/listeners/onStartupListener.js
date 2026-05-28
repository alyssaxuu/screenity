import { tryResumePendingUploads } from "../recording/resumePendingUploads";
import { loginWithWebsite } from "../auth/loginWithWebsite";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

// For some reason without this the service worker doesn't always work
export const onStartupListener = async () => {
  chrome.runtime.onStartup.addListener(() => {
    if (globalThis.SCREENITY_VERBOSE_LOGS) {
      console.log("Service worker started up successfully.");
    }
    setTimeout(() => {
      tryResumePendingUploads({ trigger: "onStartup" }).catch(() => {});
    }, 5000);
    // pick up a web login that fired AUTH_SUCCESS while the SW was asleep.
    // gated on signals so fresh installs don't hammer /auth/refresh.
    if (CLOUD_FEATURES_ENABLED) {
      chrome.storage.local
        .get(["wasLoggedIn", "hasSubscribedBefore", "screenityUser", "screenityToken"])
        .then((s) => {
          if (
            s.wasLoggedIn ||
            s.hasSubscribedBefore ||
            s.screenityUser ||
            s.screenityToken
          ) {
            loginWithWebsite({ force: true }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  });
};
