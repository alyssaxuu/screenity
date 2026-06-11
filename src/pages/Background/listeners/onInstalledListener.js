import { executeScripts } from "../utils/executeScripts";
import { supportContextQuery } from "../../utils/buildSupportContext";
import { tryResumePendingUploads } from "../recording/resumePendingUploads";

const cloudFeaturesEnabled =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const onInstalledListener = () => {
  chrome.runtime.onInstalled.addListener(async (details) => {
    const version = chrome.runtime.getManifest().version;

    if (details.reason === "install") {
      chrome.storage.local.clear();

      const installQs = await supportContextQuery({ source: "uninstall" });
      const installUrl = `https://tally.so/r/w8Zro5?${installQs}`;
      chrome.runtime.setUninstallURL(installUrl);

      chrome.storage.local.set({
        firstTime: true,
        onboarding: cloudFeaturesEnabled,
        bannerSupport: true,
        firstTimePro: cloudFeaturesEnabled,
        extensionInstalledAt: Date.now(),
      });

      chrome.storage.managed.get("skipSetup", (managedConfig) => {
        const skipSetup = managedConfig.skipSetup ?? false;
        if (!skipSetup) {
          chrome.tabs.create({ url: "setup.html" });
        }
      });
    } else if (details.reason === "update") {
      // give WebCodecs a fresh shot on update: a one-time watchdog trip on
      // an older build shouldn't permanently pin a user to MediaRecorder.
      chrome.storage.local.remove([
        "fastRecorderDisabledForDevice",
        "fastRecorderDisabledReason",
        "fastRecorderDisabledAt",
        "fastRecorderDisabledDetails",
      ]);
      if (details.previousVersion === "2.8.6") {
        chrome.storage.local.set({ updatingFromOld: true });
      } else {
        chrome.storage.local.set({ updatingFromOld: false });

        if (details.previousVersion === "3.1.16" && cloudFeaturesEnabled) {
          chrome.storage.local.set({
            showProSplash: cloudFeaturesEnabled,
            bannerSupport: true,
            onboarding: cloudFeaturesEnabled,
          });
        }
      }

      // Existing users are already established, so backfill an install time in
      // the past to clear the review prompt's install-age gate immediately.
      const { extensionInstalledAt } = await chrome.storage.local.get(
        "extensionInstalledAt",
      );
      if (typeof extensionInstalledAt !== "number") {
        chrome.storage.local.set({ extensionInstalledAt: 0 });
      }

      const updateQs = await supportContextQuery({ source: "uninstall" });
      const updateUrl = `https://tally.so/r/3Ex6kX?${updateQs}`;
      chrome.runtime.setUninstallURL(updateUrl);
    }

    if (details.reason === "install") {
      chrome.storage.local.set({ systemAudio: true });
    }
    chrome.storage.local.set({ offscreenRecording: false });

    // Backfill content scripts into already-open tabs. manifest
    // content_scripts only auto-inject on future loads; without this,
    // a fresh install / update can't record on tabs that were already
    // open. The `install` gate causes React double-mount under dev
    // HMR; accepted tradeoff vs the prod break.
    if (details.reason === "install" || details.reason === "update") {
      executeScripts();
    }

    setTimeout(() => {
      tryResumePendingUploads({ trigger: `onInstalled:${details.reason}` }).catch(
        () => {},
      );
    }, 5000);
  });
};
