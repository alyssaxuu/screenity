import { getCurrentTab, sendMessageTab, removeTab } from "../tabManagement";
import { loginWithWebsite } from "../auth/loginWithWebsite";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const onMessageExternalListener = () => {
  if (!CLOUD_FEATURES_ENABLED) return;

  chrome.runtime.onMessageExternal.addListener(
    async (message, sender, sendResponse) => {
      if (message.type === "AUTH_SUCCESS" && message.token) {
        chrome.storage.local.set({
          screenityToken: message.token,
          screenityUser: null,
          proSubscription: null,
          lastAuthCheck: 0,
          wasLoggedIn: true,
          pushToTalk: false,
          onboarding: false,
          showProSplash: false,
        });

        const auth = await loginWithWebsite();

        await chrome.storage.local.set({
          screenityUser: auth.user,
          isSubscribed: auth.subscribed,
          proSubscription: auth.proSubscription,
          hasSubscribedBefore: auth.hasSubscribedBefore,
          lastAuthCheck: Date.now(),
        });

        const tabResult = await chrome.storage.local.get("originalTabId");
        const originalTabId = tabResult.originalTabId as number | undefined;

        if (originalTabId) {
          chrome.tabs.update(originalTabId, { active: true });
          sendMessageTab(originalTabId, { type: "LOGIN_SUCCESS" });

          if (sender.tab?.id) {
            chrome.tabs.remove(sender.tab.id); // Close login tab
          }

          await chrome.storage.local.remove("originalTabId");

          // Message tab to update from storage
          if (sender.tab?.id) {
            sendMessageTab(originalTabId, {
              type: "check-auth",
              senderId: sender.tab.id,
            });
          }
        }

        return true;
      } else if (message.type === "SIGN_OUT") {
        // Clear all auth-related storage
        await chrome.storage.local.remove([
          "screenityToken",
          "screenityUser",
          "lastAuthCheck",
          "isSubscribed",
          "isLoggedIn",
          "proSubscription",
          "hasSubscribedBefore",
        ]);

        return true;
      } else if (message.type === "OPEN_POPUP_PROJECT") {
        try {
          const tab = await getCurrentTab();
          if (!tab?.id) {
            console.warn("No active tab found for popup reopen");
            return;
          }

          await chrome.storage.local.set({
            recordingProjectTitle: message.recordingProjectTitle,
            recordingToScene: true,
            instantMode: false,
            projectId: message.projectId,
            activeSceneId: message.activeSceneId,
            editorTab: tab.id, // Set editorTab in storage
          });

          const result = await loginWithWebsite();

          if (!result?.authenticated) {
            const currentTab = await getCurrentTab();
            if (currentTab?.id) {
              await chrome.storage.local.set({ originalTabId: currentTab.id });
            }

            chrome.tabs.create({
              url: `${process.env.SCREENITY_APP_BASE}/login?extension=true`,
              active: true,
            });
            return;
          }

          await sendMessageTab(tab.id, {
            type: "open-popup-project",
            projectTitle: message.recordingProjectTitle,
            projectId: message.projectId,
            activeSceneId: message.activeSceneId,
            recordingToScene: true,
          });
        } catch (err) {
          console.warn("Failed to send popup project message:", err);
        }
      } else if (message.type === "GET_PROJECT_INFO") {
        const tab = await getCurrentTab();
        if (!tab?.id) {
          console.warn("No active tab found for popup reopen");
          return;
        }

        await chrome.storage.local.set({
          recordingProjectTitle: message.recordingProjectTitle,
          recordingToScene: true,
          instantMode: false,
          projectId: message.projectId,
          activeSceneId: message.activeSceneId,
        });

        await sendMessageTab(tab.id, {
          type: "open-popup-project",
          projectTitle: message.recordingProjectTitle,
          projectId: message.projectId,
          activeSceneId: message.activeSceneId,
          recordingToScene: true,
        });
      } else if (message.type === "PING_FROM_WEBAPP") {
        sendResponse({ success: true, message: "pong" });

        return true;
      }
    }
  );
};
