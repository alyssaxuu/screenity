import {
  getCurrentTab,
  sendMessageTab,
  parseEditorTargetUrl,
  setEditorTabReference,
  clearEditorTabReference,
} from "../tabManagement";
import { loginWithWebsite } from "../auth/loginWithWebsite";
import { handleFinishMultiRecording } from "../messaging/handlers";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const onMessageExternalListener = () => {
  if (!CLOUD_FEATURES_ENABLED) return;

  chrome.runtime.onMessageExternal.addListener(
    async (message, sender, sendResponse) => {
      if (message.type === "AUTH_SUCCESS" && message.token) {
        const { stayLoggedOut } = await chrome.storage.local.get([
          "stayLoggedOut",
        ]);
        if (stayLoggedOut) return true;

        await chrome.storage.local.set({
          screenityToken: message.token,
          screenityUser: null,
          proSubscription: null,
          lastAuthCheck: 0,
          wasLoggedIn: true,
          isLoggedIn: false,
          pushToTalk: false,
          onboarding: false,
          showProSplash: false,
        });
        // otherwise the drain listener clobbers this fresh token on next recording-end
        await chrome.storage.local.remove(["logoutPendingTokenClear"]);

        const auth = await loginWithWebsite();

        if (!auth?.authenticated) {
          await chrome.storage.local.set({
            isLoggedIn: false,
          });
          return true;
        }

        await chrome.storage.local.set({
          isLoggedIn: true,
          wasLoggedIn: false,
          stayLoggedOut: false,
          screenityUser: auth.user,
          isSubscribed: auth.subscribed,
          proSubscription: auth.proSubscription,
          hasSubscribedBefore: auth.hasSubscribedBefore,
          lastAuthCheck: Date.now(),
        });

        const { originalTabId } = await chrome.storage.local.get(
          "originalTabId"
        );

        if (originalTabId) {
          chrome.tabs.update(originalTabId, { active: true });
          sendMessageTab(originalTabId, { type: "LOGIN_SUCCESS" });

          if (sender.tab?.id) {
            chrome.tabs.remove(sender.tab.id);
          }

          await chrome.storage.local.remove("originalTabId");

          sendMessageTab(originalTabId, {
            type: "check-auth",
            senderId: sender.tab.id,
          });
        }

        return true;
      } else if (message.type === "SIGN_OUT") {
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
          });

          const parsedTarget = parseEditorTargetUrl(tab.url);
          if (parsedTarget?.projectId === message.projectId) {
            await setEditorTabReference({
              tabId: tab.id,
              tabUrl: tab.url,
              source: "webapp-open-popup-project",
              expectedProjectId: message.projectId,
            });
          } else {
            await clearEditorTabReference("webapp-open-popup-project-not-editor", {
              tabId: tab.id,
              tabUrl: tab.url,
              expectedProjectId: message.projectId,
            });
          }

          const result = await loginWithWebsite({ force: true });

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
      } else if (message.type === "FINISH_MULTI_RECORDING") {
        // Same logic as clicking the popup's Finish button. Used by
        // web-app "I'm done adding scenes" flows and by e2e tests where
        // we can't drive the popup UI directly.
        await handleFinishMultiRecording();
        sendResponse({ success: true });
        return true;
      }
    }
  );
};
