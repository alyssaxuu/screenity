import { removeTab } from "../tabManagement";
import { executeScripts } from "../utils/executeScripts";
import { supportContextQuery } from "../../utils/buildSupportContext";

const cloudFeaturesEnabled =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const onInstalledListener = () => {
  chrome.runtime.onInstalled.addListener(async (details) => {
    const version = chrome.runtime.getManifest().version;
    const locale = chrome.i18n.getMessage("@@ui_locale");

    if (details.reason === "install") {
      // Clear storage on fresh install
      chrome.storage.local.clear();

      // Set uninstall URL based on locale
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
        // Do not clear local storage on update; preserve onboarding/versioned keys.
        chrome.storage.local.set({ updatingFromOld: true });
      } else {
        chrome.storage.local.set({ updatingFromOld: false });

        // Onboarding for new cloud version
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

    // Disable backups for older Chrome versions
    if (navigator.userAgent.includes("Chrome/")) {
      const chromeVersion = parseInt(
        navigator.userAgent.match(/Chrome\/([0-9]+)/)?.[1] ?? "0"
      );
      if (chromeVersion <= 109) {
        chrome.storage.local.set({ backup: false });
      }
    }

    if (details.reason === "install") {
      chrome.storage.local.set({ systemAudio: true });
    }

    const { backupTab } = await chrome.storage.local.get(["backupTab"]);
    if (backupTab) {
      removeTab(backupTab);
    }

    executeScripts();
  });
};
