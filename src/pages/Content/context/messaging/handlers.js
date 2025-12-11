// src/content/handlers/recordingHandlers.js
import {
  registerMessage,
  messageRouter,
} from "../../../../messaging/messageRouter";
import { setContentState, contentStateRef } from "../ContentState";
import { updateFromStorage } from "../utils/updateFromStorage";
import { setTimer } from "../ContentState";

import { checkAuthStatus } from "../utils/checkAuthStatus";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

const getState = () => contentStateRef.current;

export const setupHandlers = () => {
  // Initialize message router
  if (!window.__screenityHandlersInitialized) {
    messageRouter();
    window.__screenityHandlersInitialized = true;
  }

  // Register content message handlers
  registerMessage("time", (message) => {
    chrome.storage.local.get(["recording"], (result) => {
      if (result.recording) {
        setTimer(message.time);
      }
    });
  });

  registerMessage("toggle-popup", () => {
    setContentState((prev) => ({
      ...prev,
      showExtension: !prev.showExtension,
      hasOpenedBefore: true,
      showPopup: true,
    }));
    setTimer(0);
    updateFromStorage();
  });

  registerMessage("ready-to-record", () => {
    setContentState((prev) => ({
      ...prev,
      showPopup: false,
      showExtension: true,
      preparingRecording: false,
      pendingRecording: true,
    }));

    const state = getState();

    if (state.countdown) {
      // Start countdown
      setContentState((prev) => ({
        ...prev,
        countdownActive: true,
        isCountdownVisible: true,
        countdownCancelled: false,
      }));
    } else {
      // Start recording immediately if countdown is disabled
      if (!state.countdownCancelled) {
        state.startRecordingAfterCountdown();
      }
    }
  });

  registerMessage("stop-recording-tab", () => {
    const state = getState();
    if (!state.recording) return;

    chrome.storage.local.set({ recording: false });
    setContentState((prev) => ({
      ...prev,
      recording: false,
      paused: false,
      showExtension: false,
      showPopup: true,
    }));
  });

  registerMessage("recording-ended", async () => {
    const state = getState();

    // Double-check with storage before resetting UI
    // This prevents false positives when service worker restarts with stale state
    const { recording, recorderSession, pendingRecording } =
      await chrome.storage.local.get([
        "recording",
        "recorderSession",
        "pendingRecording",
      ]);

    const isActuallyRecording =
      recording || (recorderSession && recorderSession.status === "recording");

    // Only reset if we're truly not recording
    if (isActuallyRecording || pendingRecording) {
      // Recording is actually still active - ignore this stale message
      console.warn(
        "Ignoring stale recording-ended message - recording still active"
      );
      return;
    }

    if (!state.showPopup) {
      setContentState((prev) => ({
        ...prev,
        showExtension: false,
        recording: false,
        paused: false,
        time: 0,
        timer: 0,
      }));
    }
  });

  registerMessage("recording-error", () => {
    setContentState((prev) => ({
      ...prev,
      pendingRecording: false,
      preparingRecording: false,
    }));
  });

  registerMessage("start-stream", () => {
    const state = getState();
    if (
      state.preparingRecording ||
      state.pendingRecording ||
      state.recording ||
      state.pipEnded
    ) {
      return;
    }

    setContentState((prev) => ({
      ...prev,
      showExtension: true,
      showPopup: true,
    }));

    if (state.recordingType !== "camera") {
      state.startStreaming();
    } else if (state.defaultVideoInput !== "none" && state.cameraActive) {
      state.startStreaming();
    }
  });

  registerMessage("commands", (message) => {
    if (!message) return;

    const startRecordingCommand = message.commands.find(
      (command) => command.name === "start-recording"
    );
    const cancelRecordingCommand = message.commands.find(
      (command) => command.name === "cancel-recording"
    );

    setContentState((prev) => ({
      ...prev,
      recordingShortcut: startRecordingCommand.shortcut,
      dismissRecordingShortcut: cancelRecordingCommand.shortcut,
    }));
  });

  registerMessage("cancel-recording", () => {
    const state = getState();
    state.dismissRecording();
  });

  registerMessage("pause-recording", () => {
    const state = getState();
    if (state.paused) {
      state.resumeRecording();
    } else {
      state.pauseRecording();
    }
  });

  registerMessage("set-surface", (message) => {
    setContentState((prev) => ({
      ...prev,
      surface: message.surface,
    }));
  });

  registerMessage("pip-ended", () => {
    const state = getState();
    if (state.recording || state.pendingRecording) {
      setContentState((prev) => ({
        ...prev,
        pipEnded: true,
      }));
    }
  });

  registerMessage("pip-started", () => {
    const state = getState();
    if (state.recording || state.pendingRecording) {
      setContentState((prev) => ({
        ...prev,
        pipEnded: false,
      }));
    }
  });

  registerMessage("setup-complete", () => {
    setContentState((prev) => ({
      ...prev,
      showOnboardingArrow: true,
    }));
  });

  registerMessage("hide-popup-recording", () => {
    setContentState((prev) => ({
      ...prev,
      showPopup: false,
      showExtension: false,
    }));
  });

  registerMessage("stream-error", () => {
    const state = getState();
    state.openModal(
      chrome.i18n.getMessage("streamErrorModalTitle"),
      chrome.i18n.getMessage("streamErrorModalDescription"),
      chrome.i18n.getMessage("permissionsModalDismiss"),
      null,
      () => {
        state.dismissRecording();
      },
      () => {
        state.dismissRecording();
      }
    );
  });

  registerMessage("stream-ended-warning", (message) => {
    const state = getState();
    // Show a toast warning but don't stop the recording
    // The user can decide whether to continue or stop manually
    if (state.openToast) {
      state.openToast(
        message.message ||
          "Screen sharing stopped. Stop recording to save your video.",
        () => {},
        10000 // Show for 10 seconds
      );
    }
  });

  registerMessage("backup-error", () => {
    const state = getState();
    state.openModal(
      chrome.i18n.getMessage("backupPermissionFailTitle"),
      chrome.i18n.getMessage("backupPermissionFailDescription"),
      chrome.i18n.getMessage("permissionsModalDismiss"),
      null,
      () => {
        state.dismissRecording();
      },
      () => {
        state.dismissRecording();
      }
    );
  });

  registerMessage("recording-check", (message, sender) => {
    const { recordingStartTime } = message;

    if (recordingStartTime) {
      const time = Math.floor((Date.now() - recordingStartTime) / 1000);
      setTimer(time);
    }

    const state = getState();

    if (!message.force) {
      if (!state.showExtension && !state.recording) {
        updateFromStorage(true, sender.id);
      }
    } else {
      setContentState((prev) => ({
        ...prev,
        showExtension: true,
        recording: true,
      }));
      updateFromStorage(false, sender.id);
    }
  });

  registerMessage("stop-pending", () => {
    setContentState((prev) => ({
      ...prev,
      pendingRecording: false,
      preparingRecording: false,
    }));
  });

  registerMessage("reopen-popup-multi", (message) => {
    setContentState((prev) => ({
      ...prev,
      showExtension: true,
      showPopup: true,
    }));
    updateFromStorage(false, message.senderId);

    setTimeout(() => {
      const state = getState();
      if (state.openToast) {
        state.openToast(chrome.i18n.getMessage("addedToMultiToast"), () => {});
      }
    }, 1000);
  });

  registerMessage("open-popup-project", (message) => {
    setContentState((prev) => ({
      ...prev,
      showExtension: true,
      showPopup: true,
      recordingProjectTitle: message.projectTitle,
      projectId: message.projectId,
      recordingToScene: message.recordingToScene,
      activeSceneId: message.activeSceneId,
    }));

    updateFromStorage(false, message.senderId);

    setTimeout(() => {
      const state = getState();
      if (state.openToast) {
        state.openToast(
          chrome.i18n.getMessage("readyRecordSceneToast"),
          () => {}
        );
      }
    }, 1000);
  });

  registerMessage("time-warning", () => {
    // Only trigger when actively recording
    const state = getState();

    if (state.recording && !state.paused) {
      setContentState((prev) => ({
        ...prev,
        timeWarning: true,
      }));

      if (state.openToast) {
        state.openToast(
          chrome.i18n.getMessage("reachingRecordingLimitToast"),
          () => {},
          5000
        );
      }
    }
  });
  registerMessage("time-stopped", () => {
    const state = getState();
    // Only trigger when actively recording
    if (state.recording && !state.paused) {
      setContentState((prev) => ({
        ...prev,
        timeWarning: false,
      }));

      if (state.openToast) {
        state.openToast(
          chrome.i18n.getMessage("recordingLimitReachedToast"),
          () => {},
          5000
        );
      }
    }
  });

  registerMessage("get-project-info", (message) => {
    window.postMessage({ source: "get-project-info" }, "*");
  });
  registerMessage("check-auth", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      // Default to local user
      const { recording } = await chrome.storage.local.get("recording");

      setContentState((prev) => ({
        ...prev,
        isLoggedIn: false,
        screenityUser: null,
        isSubscribed: false,
        proSubscription: null,
        showExtension: true,
        showPopup: !recording,
      }));

      return;
    }

    const result = await checkAuthStatus();

    const { recording } = await chrome.storage.local.get("recording");

    setContentState((prev) => ({
      ...prev,
      isLoggedIn: result.authenticated,
      screenityUser: result.user,
      isSubscribed: result.subscribed,
      proSubscription: result.proSubscription,
      showExtension: true,
      showPopup: !recording,
    }));

    if (result.authenticated) {
      // Offscreen recording and client-side zoom are not available
      setContentState((prev) => ({
        ...prev,
        offscreenRecording: false,
        onboarding: false,
        showProSplash: false,
        zoomEnabled: false,
      }));

      chrome.storage.local.set({
        offscreenRecording: false,
        zoomEnabled: false,
      });
    }
  });
  registerMessage("update-project-loading", (message, sender) => {
    window.postMessage(
      { source: "update-project-loading", multiMode: message.multiMode },
      "*"
    );

    if (!message.multiMode) {
      setContentState((prev) => ({
        ...prev,
        showExtension: false,
        showPopup: false,
      }));
    }

    updateFromStorage(true, sender.id);
  });
  registerMessage("update-project-ready", (message) => {
    window.postMessage(
      {
        source: "update-project-ready",
        share: message.share,
        newProject: message.newProject,
        sceneId: message.sceneId,
      },
      "*"
    );
  });
  registerMessage("clear-project-recording", (message) => {
    updateFromStorage(false, message.senderId);
  });
  registerMessage("preparing-recording", () => {
    setContentState((prev) => ({
      ...prev,
      preparingRecording: true,
      showExtension: true,
      showPopup: false,
    }));
  });
};
