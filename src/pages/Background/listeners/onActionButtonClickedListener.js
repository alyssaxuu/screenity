import {
  sendMessageTab,
  getCurrentTab,
  setEditorTabReference,
  clearEditorTabReference,
} from "../tabManagement";
import { sendMessageRecord } from "../recording/sendMessageRecord.js";
import { loginWithWebsite } from "../auth/loginWithWebsite.js";
import { tryResumePendingUploads } from "../recording/resumePendingUploads";
import { clearInMemoryEditorLock } from "../recording/stopRecording";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

const handleTabMessaging = async (tab) => {
  const { activeTab, recordingUiTabId, offscreen } =
    await chrome.storage.local.get([
      "activeTab",
      "recordingUiTabId",
      "offscreen",
    ]);

  if (offscreen) {
    try {
      await sendMessageRecord({ type: "stop-recording-tab" });
      return;
    } catch (err) {
      console.error(
        "[Screenity][ActionClick] offscreen stop-recording send failed:",
        err,
      );
      return;
    }
  }

  const preferredTabId = recordingUiTabId || activeTab;

  try {
    const targetTab = preferredTabId
      ? await chrome.tabs.get(preferredTabId)
      : null;

    if (targetTab) {
      await sendMessageTab(preferredTabId, { type: "stop-recording-tab" });
    } else {
      await sendMessageTab(tab.id, { type: "stop-recording-tab" });
      chrome.storage.local.set({ activeTab: tab.id });
    }
  } catch (error) {
    console.error("[Screenity][ActionClick] handleTabMessaging failed, trying direct recorder stop:", error);
    try {
      await sendMessageRecord({ type: "stop-recording-tab" });
    } catch (recorderErr) {
      console.error("[Screenity][ActionClick] direct recorder stop also failed:", recorderErr);
    }
  }
};

const openPlaygroundOrPopup = async (tab) => {
  const editorUrlPattern =
    /https:\/\/app\.screenity\.io\/editor\/([^\/]+)(\/edit)?\/?/;

  if (tab.url && editorUrlPattern.test(tab.url)) {
    const match = tab.url.match(editorUrlPattern);
    const projectIdFromUrl = match?.[2] || null;
    await setEditorTabReference({
      tabId: tab.id,
      tabUrl: tab.url,
      source: "action-click-editor",
      expectedProjectId: projectIdFromUrl,
    });

    if (CLOUD_FEATURES_ENABLED) {
      const result = await loginWithWebsite({ force: true });

      if (result?.authenticated) {
        await chrome.storage.local.set({
          projectId: projectIdFromUrl,
          recordingToScene: true,
          instantMode: false,
        });

        sendMessageTab(tab.id, {
          type: "get-project-info",
        });
      } else {
        await chrome.storage.local.set({
          projectId: null,
          recordingToScene: false,
          activeSceneId: null,
        });
      }
    } else {
      await chrome.storage.local.set({
        projectId: null,
        recordingToScene: false,
        activeSceneId: null,
      });
    }
  } else {
    await clearEditorTabReference("action-click-non-editor-tab", {
      tabId: tab.id,
      tabUrl: tab.url,
    });
    await chrome.storage.local.set({
      projectId: null,
      recordingToScene: false,
      activeSceneId: null, // reset scene too if needed
    });
  }

  const forbiddenURLs = [
    "chrome://",
    "chrome-extension://",
    "chrome.google.com/webstore",
    "chromewebstore.google.com",
    "stackoverflow.com/",
  ];

  const tabUrl = String(tab?.url || "");
  const isForbidden = forbiddenURLs.some((url) => tabUrl.startsWith(url));
  const isPlaygroundOrSetup =
    tabUrl.includes("/playground.html") || tabUrl.includes("/setup.html");

  // never gate on navigator.onLine; that caused duplicate playground tabs
  if (!isForbidden || isPlaygroundOrSetup) {
    sendMessageTab(tab.id, { type: "toggle-popup" })
      .then(() => console.log("[Screenity][ActionClick] toggle-popup delivered to tab", tab.id))
      .catch((err) => console.error("[Screenity][ActionClick] toggle-popup FAILED to tab", tab.id, String(err).slice(0, 120)));
    chrome.storage.local.set({ activeTab: tab.id });
  } else {
    const newTab = await chrome.tabs.create({
      url: "playground.html",
      active: true,
    });
    chrome.storage.local.set({ activeTab: newTab.id });

    const onUpdated = (tabId, changeInfo, updatedTab) => {
      if (updatedTab.id === newTab.id && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        setTimeout(() => {
          sendMessageTab(newTab.id, { type: "toggle-popup" });
        }, 500);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  }
};

const doesTabExist = async (tabId) => {
  if (!Number.isInteger(tabId)) return false;
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
};

const isOffscreenAlive = async () => {
  try {
    const contexts = await chrome.runtime.getContexts({});
    return contexts.some((c) => c.contextType === "OFFSCREEN_DOCUMENT");
  } catch {
    return false;
  }
};

export const onActionButtonClickedListener = () => {
  chrome.action.onClicked.addListener(async (tab) => {
    tryResumePendingUploads({ trigger: "actionClick" }).catch(() => {});
    try {
      const snap = await chrome.storage.local.get([
        "recording", "pendingRecording", "restarting", "recorderSession",
        "recordingTab", "offscreen",
        "postStopEditorOpening", "postStopEditorOpened",
        "editorRecoveryUrl",
      ]);
      console.log("[Screenity][ActionClick] storage:", snap, "tab:", tab.id);

      if (snap.editorRecoveryUrl) {
        await chrome.storage.local.remove(["editorRecoveryUrl", "editorRecoveryAt"]);
      }

      const { recording, pendingRecording, restarting, recorderSession } = snap;
      const sessionRecording = recorderSession?.status === "recording";
      // Whitelist of statuses that indicate a session may still have
      // work in flight. Anything else — completed, cancelled, failed,
      // crashed, stale-cleared, stopped, or any future addition — gets
      // bypass treatment so stale pendingRecording/recordingTab flags
      // can fall through to the reset+reopen path. Whitelisting is
      // safer than blacklisting: forgetting to add a new terminal
      // status would silently trap users.
      const sessionInFlight =
        recorderSession?.status === "recording" ||
        recorderSession?.status === "restarting";
      const sessionTerminal = Boolean(recorderSession?.status) && !sessionInFlight;
      const isRecordingActive = Boolean(
        recording || pendingRecording || restarting || sessionRecording,
      );

      if (isRecordingActive) {
        const { recordingTab, offscreen } = snap;
        let hasActiveRecorder = false;

        if (sessionRecording) {
          const sessionOwnerTabId =
            recorderSession?.recorderTabId || recorderSession?.tabId || null;
          if (sessionOwnerTabId && (await doesTabExist(sessionOwnerTabId))) {
            hasActiveRecorder = true;
          } else {
            console.warn(
              "[Screenity][ActionClick] recorderSession stale (owner tab",
              sessionOwnerTabId,
              "is dead) — clearing",
            );
            chrome.storage.local.set({
              recorderSession: recorderSession
                ? { ...recorderSession, status: "stale-cleared", clearedAt: Date.now() }
                : null,
            });
          }
        }

        if (recordingTab && !hasActiveRecorder && !sessionTerminal) {
          if (await doesTabExist(recordingTab)) {
            hasActiveRecorder = true;
          } else {
            console.warn("[Screenity][ActionClick] recordingTab", recordingTab, "is dead — clearing");
            chrome.storage.local.set({ recordingTab: null });
          }
        }

        if (offscreen && !hasActiveRecorder && !sessionTerminal) {
          if (await isOffscreenAlive()) {
            hasActiveRecorder = true;
          } else {
            console.warn("[Screenity][ActionClick] offscreen flag stale (no document) — clearing");
            chrome.storage.local.set({ offscreen: false });
          }
        }

        if (!hasActiveRecorder) {
          console.warn(
            "[Screenity][ActionClick] branch: stale-reset-then-popup.",
            { recording, pendingRecording, restarting, sessionRecording, recordingTab, offscreen },
          );
          clearInMemoryEditorLock();
          await chrome.storage.local.set({
            recording: false,
            pendingRecording: false,
            restarting: false,
            offscreen: false,
            recordingTab: null,
            postStopEditorOpened: false,
            postStopEditorOpening: false,
            recordingToScene: false,
            projectId: null,
            activeSceneId: null,
          });
          chrome.runtime
            .sendMessage({ type: "clear-recording-session-safe", reason: "action-button-stale-reset" })
            .catch(() => {});
          await openPlaygroundOrPopup(tab);
        } else {
          console.log("[Screenity][ActionClick] branch: handle-tab-messaging (active recorder)");
          await handleTabMessaging(tab);
        }
      } else {
        console.log("[Screenity][ActionClick] branch: normal-popup");
        await chrome.storage.local.set({
          recordingToScene: false,
          projectId: null,
          activeSceneId: null,
        });
        await openPlaygroundOrPopup(tab);
      }

      const { firstTime } = await chrome.storage.local.get(["firstTime"]);
      if (firstTime && tab.url.includes(chrome.runtime.getURL("setup.html"))) {
        chrome.storage.local.set({ firstTime: false });
        const activeTab = await getCurrentTab();
        sendMessageTab(activeTab.id, { type: "setup-complete" });
      }
    } catch (error) {
      console.error("Error handling action click:", error);
    }
  });
};
