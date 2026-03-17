// src/content/handlers/recordingHandlers.js
import {
  registerMessage,
  messageRouter,
} from "../../../../messaging/messageRouter";
import { setContentState, contentStateRef } from "../ContentState";
import { updateFromStorage } from "../utils/updateFromStorage";

import { checkAuthStatus } from "../utils/checkAuthStatus";
import JSZip from "jszip";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

const getState = () => contentStateRef.current;

export const setupHandlers = () => {
  if (window.__screenitySetupHandlersRan) return;
  window.__screenitySetupHandlersRan = true;
  let lastToggleDrawingAt = 0;
  const TOGGLE_DRAWING_COOLDOWN_MS = 400;
  let projectReadySeq = 0;
  const LOCAL_PLAYBACK_MAX_BYTES = 250 * 1024 * 1024;
  let latestLocalPlaybackOffer = null;
  let latestLocalPlaybackProjectId = null;
  let latestLocalPlaybackSceneId = null;
  let localPlaybackBuildPromise = null;
  let localPlaybackBuildOfferId = null;
  let activeLocalPlaybackSource = null;
  const TRUSTED_APP_ORIGIN = (() => {
    try {
      const appBase = process.env.SCREENITY_APP_BASE;
      return appBase ? new URL(appBase).origin : null;
    } catch {
      return null;
    }
  })();

  const getProjectMessageTargetOrigin = () => {
    if (!TRUSTED_APP_ORIGIN) return null;
    return window.location.origin === TRUSTED_APP_ORIGIN
      ? TRUSTED_APP_ORIGIN
      : null;
  };

  const postProjectHandoff = (payload) => {
    const targetOrigin = getProjectMessageTargetOrigin();
    if (!targetOrigin) {
      console.warn(
        "[Screenity][Content] Ignoring project handoff on untrusted origin",
        {
          source: payload?.source || "unknown",
          pageOrigin: window.location.origin,
          trustedOrigin: TRUSTED_APP_ORIGIN,
          projectId: payload?.projectId || null,
        },
      );
      return false;
    }

    window.postMessage(payload, targetOrigin);
    // Replay once shortly after first post to reduce race conditions with late listeners.
    setTimeout(() => {
      window.postMessage(
        {
          ...payload,
          replay: true,
          replayAt: Date.now(),
        },
        targetOrigin,
      );
    }, 250);
    return true;
  };

  const revokeActiveLocalPlaybackSource = (reason = "unknown") => {
    if (activeLocalPlaybackSource?.url) {
      URL.revokeObjectURL(activeLocalPlaybackSource.url);
      console.info("[Screenity][Content] Revoked local screen playback URL", {
        reason,
        offerId: activeLocalPlaybackSource.offerId || null,
      });
    }
    activeLocalPlaybackSource = null;
  };

  const markLocalPlaybackFallback = async ({
    offerId,
    projectId,
    sceneId,
    reason,
  }) => {
    if (!offerId) return;
    try {
      await chrome.runtime.sendMessage({
        type: "cloud-local-playback-mark-fallback",
        offerId,
        projectId: projectId || null,
        sceneId: sceneId || null,
        reason: reason || "unknown",
      });
    } catch {
      // best effort
    }
  };

  const fetchLocalPlaybackSourceFromExtension = async ({
    offerId,
    projectId,
    sceneId,
  }) => {
    const offerRes = await chrome.runtime.sendMessage({
      type: "cloud-local-playback-get-offer",
      offerId,
      projectId,
      sceneId,
    });
    if (!offerRes?.ok || !offerRes.offer) {
      throw new Error("local-playback-offer-unavailable");
    }
    const offer = offerRes.offer;
    if (
      !offer.chunkCount ||
      !offer.estimatedBytes ||
      offer.estimatedBytes > LOCAL_PLAYBACK_MAX_BYTES
    ) {
      throw new Error("local-playback-offer-too-large-or-empty");
    }

    const parts = [];
    for (let i = 0; i < offer.chunkCount; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const chunkRes = await chrome.runtime.sendMessage({
        type: "cloud-local-playback-read-chunk",
        offerId: offer.offerId,
        projectId: offer.projectId,
        sceneId: offer.sceneId,
        index: i,
      });
      if (!chunkRes?.ok || !chunkRes.chunk?.base64) {
        throw new Error(`local-playback-chunk-read-failed:${i}`);
      }
      const binary = atob(chunkRes.chunk.base64);
      const bytes = new Uint8Array(binary.length);
      for (let j = 0; j < binary.length; j += 1) {
        bytes[j] = binary.charCodeAt(j);
      }
      const mimeType = chunkRes.chunk.mimeType || "video/webm";
      parts.push(new Blob([bytes], { type: mimeType }));
    }

    const blob = new Blob(parts, {
      type: parts[0]?.type || "video/webm",
    });
    const url = URL.createObjectURL(blob);
    return {
      offer,
      url,
      size: blob.size || 0,
      mimeType: blob.type || "video/webm",
      chunkCount: parts.length,
    };
  };

  const ensureLocalPlaybackReady = async ({ projectId, sceneId, offer }) => {
    if (!offer?.offerId) {
      throw new Error("local-playback-offer-missing");
    }

    if (
      activeLocalPlaybackSource?.offerId === offer.offerId &&
      activeLocalPlaybackSource?.url
    ) {
      return activeLocalPlaybackSource;
    }

    if (
      localPlaybackBuildPromise &&
      localPlaybackBuildOfferId === offer.offerId
    ) {
      return localPlaybackBuildPromise;
    }

    localPlaybackBuildOfferId = offer.offerId;
    localPlaybackBuildPromise = (async () => {
      const source = await fetchLocalPlaybackSourceFromExtension({
        offerId: offer.offerId,
        projectId,
        sceneId,
      });

      revokeActiveLocalPlaybackSource("new-offer");
      activeLocalPlaybackSource = {
        offerId: source.offer.offerId,
        projectId: source.offer.projectId || projectId || null,
        sceneId: source.offer.sceneId || sceneId || null,
        url: source.url,
        mimeType: source.mimeType,
        size: source.size,
        chunkCount: source.chunkCount,
        expiresAt: source.offer.expiresAt || null,
      };

      try {
        await chrome.runtime.sendMessage({
          type: "cloud-local-playback-mark-used",
          offerId: source.offer.offerId,
          projectId: source.offer.projectId || null,
          sceneId: source.offer.sceneId || null,
          usedBy: "app-editor",
        });
      } catch {
        // best effort
      }

      return activeLocalPlaybackSource;
    })();

    try {
      const ready = await localPlaybackBuildPromise;
      return ready;
    } finally {
      localPlaybackBuildPromise = null;
      localPlaybackBuildOfferId = null;
    }
  };

  const postLocalPlaybackHandoff = ({
    projectId,
    sceneId,
    offer,
    readySource = null,
    fallbackReason = null,
    forceRefresh = true,
  }) =>
    postProjectHandoff({
      source: "update-project-ready-local-playback",
      projectId: projectId || null,
      sceneId: sceneId || null,
      forceRefresh,
      handoffAt: Date.now(),
      localPlayback: {
        available: Boolean(offer?.offerId),
        trackType: "screen",
        offerId: offer?.offerId || null,
        chunkCount: offer?.chunkCount || 0,
        estimatedBytes: offer?.estimatedBytes || 0,
        expiresAt: offer?.expiresAt || null,
        source: offer?.source || "indexeddb-screen-chunks",
        ready: Boolean(readySource?.url),
        url: readySource?.url || null,
        mimeType: readySource?.mimeType || null,
        localBytes: readySource?.size || null,
        fallbackReason: fallbackReason || null,
      },
    });

  const onWindowProjectMessage = (event) => {
    if (event.source !== window) return;
    if (event.origin !== TRUSTED_APP_ORIGIN) return;
    const data = event?.data || {};
    if (data?.type !== "screenity-local-playback-request") return;

    const requestedProjectId = data?.projectId || null;
    const requestedSceneId = data?.sceneId || null;
    const requestId = data?.requestId || null;
    const offer = latestLocalPlaybackOffer;

    if (
      !offer?.offerId ||
      !offer.available ||
      !requestedProjectId ||
      requestedProjectId !== latestLocalPlaybackProjectId ||
      (requestedSceneId &&
        latestLocalPlaybackSceneId &&
        requestedSceneId !== latestLocalPlaybackSceneId)
    ) {
      postProjectHandoff({
        source: "screenity-local-playback-response",
        requestId,
        projectId: requestedProjectId,
        sceneId: requestedSceneId,
        localPlayback: {
          available: false,
          trackType: "screen",
          fallbackReason: "offer-unavailable",
        },
      });
      return;
    }

    void ensureLocalPlaybackReady({
      projectId: requestedProjectId,
      sceneId: requestedSceneId || latestLocalPlaybackSceneId,
      offer,
    })
      .then((readySource) => {
        console.info("[Screenity][Content] Local screen playback used", {
          projectId: requestedProjectId,
          sceneId: requestedSceneId || latestLocalPlaybackSceneId || null,
          offerId: offer.offerId,
          bytes: readySource?.size || 0,
        });
        postProjectHandoff({
          source: "screenity-local-playback-response",
          requestId,
          projectId: requestedProjectId,
          sceneId: requestedSceneId || latestLocalPlaybackSceneId || null,
          forceRefresh: true,
          localPlayback: {
            available: true,
            ready: true,
            trackType: "screen",
            offerId: offer.offerId,
            url: readySource?.url || null,
            mimeType: readySource?.mimeType || null,
            localBytes: readySource?.size || null,
            chunkCount: offer.chunkCount || 0,
            estimatedBytes: offer.estimatedBytes || 0,
            expiresAt: offer.expiresAt || null,
            source: offer.source || "indexeddb-screen-chunks",
          },
        });
      })
      .catch((err) => {
        const reason = err?.message || "local-playback-build-failed";
        console.warn(
          "[Screenity][Content] Local screen playback fallback",
          {
            projectId: requestedProjectId,
            sceneId: requestedSceneId || latestLocalPlaybackSceneId || null,
            offerId: offer.offerId,
            reason,
          },
        );
        void markLocalPlaybackFallback({
          offerId: offer.offerId,
          projectId: requestedProjectId,
          sceneId: requestedSceneId || latestLocalPlaybackSceneId || null,
          reason,
        });
        postProjectHandoff({
          source: "screenity-local-playback-response",
          requestId,
          projectId: requestedProjectId,
          sceneId: requestedSceneId || latestLocalPlaybackSceneId || null,
          forceRefresh: true,
          localPlayback: {
            available: true,
            ready: false,
            trackType: "screen",
            offerId: offer.offerId,
            fallbackReason: reason,
          },
        });
      });
  };

  window.addEventListener("message", onWindowProjectMessage);
  window.addEventListener("beforeunload", () => {
    revokeActiveLocalPlaybackSource("content-beforeunload");
  });

  // Initialize message router
  if (!window.__screenityHandlersInitialized) {
    messageRouter();
    window.__screenityHandlersInitialized = true;
  }

  // Register content message handlers
  registerMessage("time", () => {
    // Timer is driven by ContentState's storage-based tick.
    // Ignore external timer pushes to avoid jitter/skips.
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
      chrome.runtime.sendMessage({ type: "diag-countdown-started" }).catch(() => {});
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
    state.stopRecording();
  });

  registerMessage("toggle-drawing-mode", () => {
    const now = Date.now();
    if (now - lastToggleDrawingAt < TOGGLE_DRAWING_COOLDOWN_MS) {
      return;
    }
    lastToggleDrawingAt = now;
    if (document.hidden || !document.hasFocus()) {
      return;
    }
    const nextDrawingMode = !contentStateRef.current.drawingMode;
    setContentState((prev) => ({
      ...prev,
      drawingMode: nextDrawingMode,
      blurMode: nextDrawingMode ? false : prev.blurMode,
    }));

    registerMessage("toggle-drawing-mode", () => {
      const now = Date.now();
      if (now - lastToggleDrawingAt < TOGGLE_DRAWING_COOLDOWN_MS) return;
      lastToggleDrawingAt = now;
      if (document.hidden || !document.hasFocus()) return;

      const nextDrawingMode = !contentStateRef.current.drawingMode;

      setContentState((prev) => ({
        ...prev,
        drawingMode: nextDrawingMode,
        blurMode: nextDrawingMode ? false : prev.blurMode,
      }));

      chrome.storage.local.set({
        drawingMode: nextDrawingMode,
        ...(nextDrawingMode ? { blurMode: false } : {}),
      });
    });
  });

  registerMessage("toggle-blur-mode", () => {
    const nextBlurMode = !contentStateRef.current.blurMode;
    setContentState((prev) => ({
      ...prev,
      blurMode: nextBlurMode,
      drawingMode: nextBlurMode ? false : prev.drawingMode,
    }));
    chrome.storage.local.set({
      blurMode: nextBlurMode,
      drawingMode: nextBlurMode ? false : contentStateRef.current.drawingMode,
    });
  });

  registerMessage("toggle-hide-ui", () => {
    const nextHideUI = !contentStateRef.current.hideUI;
    setContentState((prev) => ({
      ...prev,
      hideUI: nextHideUI,
      hideToolbar: nextHideUI ? true : prev.hideToolbar,
      hideUIAlerts: nextHideUI ? true : prev.hideUIAlerts,
    }));
    chrome.storage.local.set({
      hideUI: nextHideUI,
      ...(nextHideUI ? { hideToolbar: true, hideUIAlerts: true } : {}),
    });
  });

  registerMessage("toggle-cursor-mode", () => {
    const state = getState();
    const nextMode =
      contentStateRef.current.cursorMode === "none" ? "cursor" : "";
    if (state?.setToolbarMode) {
      state.setToolbarMode(nextMode);
    } else {
      setContentState((prev) => ({
        ...prev,
        toolbarMode: nextMode,
      }));
    }
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
        "Ignoring stale recording-ended message - recording still active",
      );
      return;
    }

    if (!state.showPopup) {
      setContentState((prev) => ({
        ...prev,
        showExtension: false,
        recording: false,
        paused: false,
        pipEnded: false,
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
      pipEnded: false,
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
      console.warn("[Screenity][Content] start-stream BLOCKED by guard state:", {
        preparingRecording: state.preparingRecording,
        pendingRecording: state.pendingRecording,
        recording: state.recording,
        pipEnded: state.pipEnded,
      });
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
      (command) => command.name === "start-recording",
    );
    const cancelRecordingCommand = message.commands.find(
      (command) => command.name === "cancel-recording",
    );
    const toggleDrawingModeCommand = message.commands.find(
      (command) => command.name === "toggle-drawing-mode",
    );
    const toggleBlurModeCommand = message.commands.find(
      (command) => command.name === "toggle-blur-mode",
    );
    const toggleCursorModeCommand = message.commands.find(
      (command) => command.name === "toggle-cursor-mode",
    );

    setContentState((prev) => ({
      ...prev,
      recordingShortcut: startRecordingCommand.shortcut,
      dismissRecordingShortcut: cancelRecordingCommand.shortcut,
      toggleDrawingModeShortcut: toggleDrawingModeCommand?.shortcut || "",
      toggleBlurModeShortcut: toggleBlurModeCommand?.shortcut || "",
      toggleCursorModeShortcut: toggleCursorModeCommand?.shortcut || "",
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

  registerMessage("stream-error", (message) => {
    const state = getState();
    const errorCode = message?.errorCode || null;
    const errorWhy = message?.why || message?.error || null;

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
      },
      null, // image
      null, // learnMore
      null, // learnMoreLink
      false, // colorSafe
      chrome.i18n.getMessage("getHelpButton"),
      () => {
        chrome.runtime.sendMessage({
          type: "report-error",
          errorCode,
          errorWhy,
          source: "stream-error",
        });
      },
    );
  });

  registerMessage("stream-ended-warning", (message) => {
    const state = getState();
    // Show a toast warning but don't stop the recording
    // The user can decide whether to continue or stop manually
    if (state.openToast) {
      state.openToast(
        message.message ||
          chrome.i18n.getMessage("streamEndedWarningToast"),
        () => {},
        10000, // Show for 10 seconds
      );
    }
  });

  registerMessage("show-toast", (message) => {
    const state = getState();
    if (typeof state.openToast !== "function") return;
    state.openToast(message?.message || "", () => {}, message?.timeout || 5000);
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
      },
    );
  });

  registerMessage("fast-recorder-hard-fail", async () => {
    const state = getState();
    if (typeof state.openModal !== "function") return;

    const downloadBundle = async () => {
      const userAgent = navigator.userAgent;
      let platformInfo = {};
      try {
        platformInfo = await chrome.runtime.sendMessage({
          type: "get-platform-info",
        });
      } catch {}

      const manifestInfo = chrome.runtime.getManifest().version;
      const fastRecorderData = await chrome.storage.local.get([
        "fastRecorderBeta",
        "fastRecorderDecision",
        "fastRecorderDisabledForDevice",
        "fastRecorderDisabledReason",
        "fastRecorderDisabledDetails",
        "fastRecorderDisabledAt",
        "fastRecorderProbe",
        "fastRecorderValidation",
        "fastRecorderValidationFailed",
        "fastRecorderInUse",
        "fastRecorderActiveRecordingId",
      ]);

      const data = {
        userAgent: userAgent,
        platformInfo: platformInfo,
        manifestInfo: manifestInfo,
        defaultAudioInput: state.defaultAudioInput,
        defaultAudioOutput: state.defaultAudioOutput,
        defaultVideoInput: state.defaultVideoInput,
        quality: state.quality,
        systemAudio: state.systemAudio,
        audioInput: state.audioInput,
        audioOutput: state.audioOutput,
        backgroundEffectsActive: state.backgroundEffectsActive,
        recording: state.recording,
        recordingType: state.recordingType,
        askForPermissions: state.askForPermissions,
        cameraPermission: state.cameraPermission,
        microphonePermission: state.microphonePermission,
        askMicrophone: state.askMicrophone,
        cursorMode: state.cursorMode,
        zoomEnabled: state.zoomEnabled,
        offscreenRecording: state.offscreenRecording,
        updateChrome: state.updateChrome,
        permissionsChecked: state.permissionsChecked,
        permissionsLoaded: state.permissionsLoaded,
        hideUI: state.hideUI,
        alarm: state.alarm,
        alarmTime: state.alarmTime,
        surface: state.surface,
        blurMode: state.blurMode,
        fastRecorder: fastRecorderData,
      };

      const zip = new JSZip();
      zip.file("troubleshooting.json", JSON.stringify(data));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "screenity-troubleshooting.zip";
      a.click();
      window.URL.revokeObjectURL(url);

      chrome.runtime.sendMessage({ type: "indexed-db-download" });
    };

    state.openModal(
      chrome.i18n.getMessage("fastRecorderFailedTitle"),
      chrome.i18n.getMessage("fastRecorderFailedDescription"),
      chrome.i18n.getMessage("downloadAnywayButton"),
      chrome.i18n.getMessage("cancelButton"),
      () => {
        chrome.runtime.sendMessage({ type: "open-download-mp4" });
      },
      () => {},
      null,
      null,
      null,
      true,
      false,
      () => {},
    );
  });

  registerMessage("recording-check", (message, sender) => {
    const state = getState();

    if (!message.force) {
      if (!state.showExtension && !state.recording) {
        updateFromStorage(true, sender.id);
      }
    } else {
      // After navigation, PiP is always destroyed (the iframe that owned it
      // was torn down with the old page).  Set pipEnded: true so the inline
      // camera overlay is visible immediately.  If the camera iframe
      // successfully re-enters PiP later, a "pip-started" message will flip
      // this back to false.
      setContentState((prev) => ({
        ...prev,
        showExtension: true,
        recording: true,
        pipEnded: true,
      }));
      updateFromStorage(false, sender.id);
    }
  });

  registerMessage("stop-pending", () => {
    setContentState((prev) => ({
      ...prev,
      pendingRecording: false,
      preparingRecording: false,
      pipEnded: false,
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
          () => {},
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
          5000,
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
          5000,
        );
      }
    }
  });

  registerMessage("get-project-info", (message) => {
    const payload = {
      source: "get-project-info",
      requestedAt: Date.now(),
    };
    if (activeLocalPlaybackSource?.url && latestLocalPlaybackOffer?.offerId) {
      payload.localPlayback = {
        available: true,
        ready: true,
        trackType: "screen",
        offerId: latestLocalPlaybackOffer.offerId,
        url: activeLocalPlaybackSource.url,
        mimeType: activeLocalPlaybackSource.mimeType || "video/webm",
        localBytes: activeLocalPlaybackSource.size || null,
        chunkCount: latestLocalPlaybackOffer.chunkCount || 0,
        estimatedBytes: latestLocalPlaybackOffer.estimatedBytes || 0,
        expiresAt: latestLocalPlaybackOffer.expiresAt || null,
      };
    }
    postProjectHandoff(payload);
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
      ...(result.authenticated ? { wasLoggedIn: false } : {}),
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
        wasLoggedIn: false,
      });
    }
  });
  registerMessage("update-project-loading", (message, sender) => {
    window.postMessage(
      { source: "update-project-loading", multiMode: message.multiMode },
      "*",
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
  registerMessage("update-project-ready", (message, sender) => {
    const projectId = message?.projectId || null;
    if (!projectId) {
      console.warn(
        "[Screenity][Content] Ignoring update-project-ready without projectId",
      );
      return;
    }

    projectReadySeq += 1;
    const handoffAt = Date.now();
    const handoffId = `${projectId}:${handoffAt}:${projectReadySeq}`;
    const localPlayback = message?.localPlayback || null;
    latestLocalPlaybackOffer =
      localPlayback?.available && localPlayback?.trackType === "screen"
        ? localPlayback
        : null;
    latestLocalPlaybackProjectId = latestLocalPlaybackOffer ? projectId : null;
    latestLocalPlaybackSceneId = latestLocalPlaybackOffer
      ? message.sceneId || null
      : null;

    const posted = postProjectHandoff({
      source: "update-project-ready",
      share: message.share,
      newProject: message.newProject,
      sceneId: message.sceneId,
      projectId,
      localPlayback:
        localPlayback?.available && localPlayback?.trackType === "screen"
          ? {
              ...localPlayback,
              ready:
                activeLocalPlaybackSource?.offerId === localPlayback.offerId &&
                Boolean(activeLocalPlaybackSource?.url),
              url:
                activeLocalPlaybackSource?.offerId === localPlayback.offerId
                  ? activeLocalPlaybackSource.url
                  : null,
              mimeType:
                activeLocalPlaybackSource?.offerId === localPlayback.offerId
                  ? activeLocalPlaybackSource.mimeType || "video/webm"
                  : null,
              localBytes:
                activeLocalPlaybackSource?.offerId === localPlayback.offerId
                  ? activeLocalPlaybackSource.size || null
                  : null,
            }
          : {
              available: false,
              trackType: "screen",
            },
      handoffAt,
      handoffId,
      handoffSeq: projectReadySeq,
      forceRefresh: true,
    });

    if (posted) {
      window.__screenityLastProjectReady = {
        projectId,
        sceneId: message.sceneId || null,
        handoffAt,
        handoffId,
        localPlaybackOfferId: localPlayback?.offerId || null,
      };
      updateFromStorage(false, sender?.id);
    }

    const capturedOffer = latestLocalPlaybackOffer;
    if (posted && capturedOffer?.offerId) {
      const capturedSceneId = message.sceneId || null;
      console.info("[Screenity][Content] Local screen playback offered", {
        projectId,
        sceneId: capturedSceneId,
        offerId: capturedOffer.offerId,
        chunkCount: capturedOffer.chunkCount || 0,
        estimatedBytes: capturedOffer.estimatedBytes || 0,
      });
      void ensureLocalPlaybackReady({
        projectId,
        sceneId: capturedSceneId,
        offer: capturedOffer,
      })
        .then((readySource) => {
          console.info("[Screenity][Content] Local screen playback ready", {
            projectId,
            sceneId: capturedSceneId,
            offerId: capturedOffer.offerId,
            bytes: readySource?.size || 0,
          });
          postLocalPlaybackHandoff({
            projectId,
            sceneId: capturedSceneId,
            offer: capturedOffer,
            readySource,
          });
        })
        .catch((err) => {
          const reason = err?.message || "local-playback-build-failed";
          console.warn("[Screenity][Content] Local screen playback fallback", {
            projectId,
            sceneId: capturedSceneId,
            offerId: capturedOffer.offerId,
            reason,
          });
          void markLocalPlaybackFallback({
            offerId: capturedOffer.offerId,
            projectId,
            sceneId: capturedSceneId,
            reason,
          });
          postLocalPlaybackHandoff({
            projectId,
            sceneId: capturedSceneId,
            offer: capturedOffer,
            fallbackReason: reason,
          });
        });
    }
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
