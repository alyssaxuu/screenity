import { removeTab } from "../tabManagement";
import { executeScripts } from "../utils/executeScripts";
import { supportContextQuery } from "../../utils/buildSupportContext";
import { tryResumePendingUploads } from "../recording/resumePendingUploads";

const cloudFeaturesEnabled =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const onInstalledListener = () => {
  chrome.runtime.onInstalled.addListener(async (details) => {
    const version = chrome.runtime.getManifest().version;
    const locale = chrome.i18n.getMessage("@@ui_locale");

    if (details.reason === "install") {
      chrome.storage.local.clear();

      const installQs = await supportContextQuery({ source: "uninstall" });
      const installUrl = `https://tally.so/r/w8Zro5?${installQs}`;
      chrome.runtime.setUninstallURL(
        locale.includes("en")
          ? installUrl
          : `http://translate.google.com/translate?js=n&sl=auto&tl=${locale}&u=${encodeURIComponent(installUrl)}`
      );

      chrome.storage.local.set({
        firstTime: true,
        onboarding: cloudFeaturesEnabled,
        bannerSupport: true,
        firstTimePro: cloudFeaturesEnabled,
      });

      chrome.storage.managed.get("skipSetup", (managedConfig) => {
        const skipSetup = managedConfig.skipSetup ?? false;
        if (!skipSetup) {
          chrome.tabs.create({ url: "setup.html" });
        }
      });
    } else if (details.reason === "update") {
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

      const updateQs = await supportContextQuery({ source: "uninstall" });
      const updateUrl = `https://tally.so/r/3Ex6kX?${updateQs}`;
      chrome.runtime.setUninstallURL(
        locale.includes("en")
          ? updateUrl
          : `http://translate.google.com/translate?js=n&sl=auto&tl=${locale}&u=${encodeURIComponent(updateUrl)}`
      );
    }

    // Backup mode is deprecated: hidden from the settings dropdown and
    // forced off for all users on install/update. OPFS-backed recording
    // covers the same crash-resilience without the picker UX.
    chrome.storage.local.set({ backup: false, backupSetup: false });

    if (details.reason === "install") {
      chrome.storage.local.set({ systemAudio: true });
    }
    chrome.storage.local.set({ offscreenRecording: false });

    const { backupTab } = await chrome.storage.local.get(["backupTab"]);
    if (backupTab) {
      removeTab(backupTab);
    }

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
