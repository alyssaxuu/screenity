import {
  getCurrentTab,
  sendMessageTab,
  parseEditorTargetUrl,
  setEditorTabReference,
  clearEditorTabReference,
} from "../tabManagement";
import { loginWithWebsite } from "../auth/loginWithWebsite";
import {
  handleFinishMultiRecording,
  submitStageDiagnosticReport,
} from "../messaging/handlers";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const onMessageExternalListener = () => {
  if (!CLOUD_FEATURES_ENABLED) return;

  chrome.runtime.onMessageExternal.addListener(
    (message, sender, sendResponse) => {
      // Return true synchronously to keep sendResponse alive across awaits.
      if (message?.type === "OPEN_POPUP_PROJECT") {
        handleOpenPopupProject(message).then(sendResponse);
        return true;
      }
      handleExternalMessage(message, sender, sendResponse)
        .catch((err) => console.warn("External message failed:", err))
        .finally(() => {
          try {
            sendResponse();
          } catch {}
        });
      return true;
    },
  );
};

const reportStage = (stage, extra = {}) =>
  submitStageDiagnosticReport({
    attemptId: `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    trigger: "error",
    outcome: "error",
    stage,
    ...extra,
  });

const handleOpenPopupProject = async (message) => {
  try {
    const tab = await getCurrentTab();
    if (!tab?.id) {
      console.warn("No active tab found for popup reopen");
      reportStage("no-active-tab");
      return { ok: false, stage: "no-active-tab" };
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
      return { ok: false, stage: "login-required" };
    }

    try {
      await sendMessageTab(tab.id, {
        type: "open-popup-project",
        projectTitle: message.recordingProjectTitle,
        projectId: message.projectId,
        activeSceneId: message.activeSceneId,
        recordingToScene: true,
      });
    } catch (err) {
      // Content handler may not reply; a closed port still means delivered.
      if (!String(err).includes("message port closed before a response")) {
        console.warn("Failed to send popup project message:", err);
        reportStage("send-tab-failed");
        return { ok: false, stage: "send-tab-failed" };
      }
    }
    return { ok: true, stage: "delivered" };
  } catch (err) {
    console.warn("Failed to open popup project:", err);
    reportStage("handler-threw");
    return { ok: false, stage: "handler-threw" };
  }
};

const handleExternalMessage = (message, sender, sendResponse) =>
  (async () => {
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
        await chrome.storage.local.remove([
          "logoutPendingTokenClear",
          "loginPendingAt",
          "loginTabId",
        ]);

        // loginWithWebsite() consumes and clears originalTabId, so read it first
        // or the close below is unreachable and every login leaks its tab.
        const { originalTabId: loginOpenedFromTabId } =
          await chrome.storage.local.get("originalTabId");

        const auth = await loginWithWebsite();

        if (!auth?.authenticated) {
          console.warn(
            "[Screenity][Auth] AUTH_SUCCESS token did not verify, staying logged out",
          );
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

        // loginWithWebsite does the refocus, but only this scope knows the
        // sender, so the close lives here. Gated so a hand-opened /login stays put.
        if (loginOpenedFromTabId && sender.tab?.id) {
          try {
            await chrome.tabs.remove(sender.tab.id);
          } catch {}
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
  })();
