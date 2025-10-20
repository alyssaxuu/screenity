import { removeTab } from "../tabManagement";
import { executeScripts } from "../utils/executeScripts";

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
      chrome.runtime.setUninstallURL(
        locale.includes("en")
          ? `https://tally.so/r/w8Zro5?version=${version}`
          : `http://translate.google.com/translate?js=n&sl=auto&tl=${locale}&u=https://tally.so/r/w8Zro5?version=${version}`
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
        chrome.storage.local.clear();
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

      chrome.runtime.setUninstallURL(
        locale.includes("en")
          ? `https://tally.so/r/3Ex6kX?version=${version}`
          : `http://translate.google.com/translate?js=n&sl=auto&tl=${locale}&u=https://tally.so/r/3Ex6kX?version=${version}`
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

    chrome.storage.local.set({ systemAudio: true });

    const { backupTab } = await chrome.storage.local.get(["backupTab"]);
    if (backupTab) {
      removeTab(backupTab);
    }

    executeScripts();
  });
};
