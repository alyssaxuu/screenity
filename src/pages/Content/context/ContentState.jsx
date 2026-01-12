import React, { createContext, useState, useEffect, useCallback } from "react";

import { updateFromStorage } from "./utils/updateFromStorage";

// Shortcuts
import Shortcuts from "../shortcuts/Shortcuts";

// import { initializeContentMessageListener } from "./messaging/messageListener";
import { setupHandlers } from "./messaging/handlers";

import { checkAuthStatus } from "./utils/checkAuthStatus";

//create a context, with createContext api
export const contentStateContext = createContext();
export const contentStateRef = { current: null };
export let setContentState = () => {};
export let setTimer = () => {};

const ContentState = (props) => {
  const [timer, setTimerInternal] = React.useState(0);
  const CLOUD_FEATURES_ENABLED =
    process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";
  setTimer = setTimerInternal;
  const [URL, setURL] = useState(
    "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/why-does-screenity-ask-for-permissions/9AAE8zJ6iiUtCAtjn4SUT1"
  );
  const [URL2, setURL2] = useState(
    "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/how-to-grant-screenity-permission-to-record-your-camera-and-microphone/x6U69TnrbMjy5CQ96Er2E9"
  );

  // Check if the user is logged in
  const verifyUser = async () => {
    if (!CLOUD_FEATURES_ENABLED) return;
    const result = await checkAuthStatus();

    setContentState((prev) => ({
      ...prev,
      isLoggedIn: result.authenticated,
      screenityUser: result.user,
      isSubscribed: result.subscribed,
      hasSubscribedBefore: result.hasSubscribedBefore,
      proSubscription: result.proSubscription,
    }));

    if (result.authenticated) {
      // Offscreen recording and client-side zoom are not available
      setContentState((prev) => ({
        ...prev,
        offscreenRecording: false,
        zoomEnabled: false,
      }));

      chrome.storage.local.set({
        offscreenRecording: false,
        zoomEnabled: false,
      });
    }
  };
  useEffect(() => {
    verifyUser();
  }, []);

  useEffect(() => {
    const locale = chrome.i18n.getMessage("@@ui_locale");
    if (!locale.includes("en")) {
      setURL(
        "https://translate.google.com/translate?sl=en&tl=" +
          locale +
          "&u=https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/why-does-screenity-ask-for-permissions/9AAE8zJ6iiUtCAtjn4SUT1"
      );
      setURL2(
        "https://translate.google.com/translate?sl=en&tl=" +
          locale +
          "&u=https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/how-to-grant-screenity-permission-to-record-your-camera-and-microphone/x6U69TnrbMjy5CQ96Er2E9"
      );
    }
  }, []);

  const startRecording = useCallback(() => {
    if (contentStateRef.current.alarm) {
      if (contentStateRef.current.alarmTime === 0) {
        setContentState((prevContentState) => ({
          ...prevContentState,
          alarm: false,
        }));
        chrome.storage.local.set({ alarm: false });
        setTimer(0);
      } else {
        setTimer(contentStateRef.current.alarmTime);
      }
    } else {
      setTimer(0);
    }
    setContentState((prevContentState) => ({
      ...prevContentState,
      recording: true,
      paused: false,
      timeWarning: false,
      pendingRecording: false,
      preparingRecording: false,
    }));
    chrome.storage.local.set({
      recording: true,
      restarting: false,
    });

    // This cannot be triggered from here because the user might not have the page focused
    //chrome.runtime.sendMessage({ type: "start-recording" });
  }, []);

  const restartRecording = useCallback(() => {
    chrome.storage.local.set({ recording: false, restarting: true });
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: "discard-backup-restart" });
      chrome.runtime.sendMessage({ type: "restart-recording-tab" });
      // Check if custom region is set
      if (
        contentStateRef.current.recordingType === "region" &&
        contentStateRef.current.cropTarget
      ) {
        contentStateRef.current.regionCaptureRef.contentWindow.postMessage(
          {
            type: "restart-recording",
          },
          "*"
        );
      }
      if (contentStateRef.current.alarm) {
        setTimer(contentStateRef.current.alarmTime);
      } else {
        setTimer(0);
      }
      setContentState((prevContentState) => ({
        ...prevContentState,
        recording: false,
        time: 0,
        paused: false,
      }));
    }, 100);
  }, []);

  useEffect(() => {
    (async () => {
      let realSupport = false;

      if ("VideoEncoder" in window) {
        try {
          const support = await VideoEncoder.isConfigSupported({
            codec: "vp8",
            width: 16,
            height: 16,
          });
          realSupport = support.supported;
        } catch {}
      }

      chrome.storage.local.set({ realWebCodecsSupport: realSupport });
    })();
  }, []);

  const stopRecording = useCallback(() => {
    chrome.runtime.sendMessage({ type: "clear-recording-alarm" });
    chrome.storage.local.set({
      recording: false,
      restarting: false,
      tabRecordedID: null,
      pausedAt: null,
      paused: false,
      totalPausedMs: 0,
    });
    setContentState((prevContentState) => ({
      ...prevContentState,
      recording: false,
      paused: false,
      timeWarning: false,
      showExtension: false,
      blurMode: false,
      showPopup: true,
      pendingRecording: false,
      tabCaptureFrame: false,
      time: 0,
      timer: 0,
      preparingRecording: false,
    }));
    // Remove blur from all elements
    const elements = document.querySelectorAll(".screenity-blur");
    elements.forEach((element) => {
      element.classList.remove("screenity-blur");
    });
    setTimer(0);
    chrome.runtime.sendMessage({ type: "stop-recording-tab" }, (res) => {
      if (!res || res.ok !== true) {
        console.warn("Stop command not acknowledged, retrying…");
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: "stop-recording-tab" });
        }, 200);
      }
    });
    // Play beep sound at 50% volume
    const audio = new Audio(chrome.runtime.getURL("/assets/sounds/beep.mp3"));
    audio.volume = 0.5;
    audio.play();
  });

  const pauseRecording = useCallback((dismiss) => {
    chrome.runtime.sendMessage({ type: "pause-recording-tab" });

    const now = Date.now();
    chrome.storage.local.set({
      paused: true,
      pausedAt: now,
    });

    setTimeout(() => {
      setContentState((prev) => ({
        ...prev,
        paused: true,
      }));
      if (!dismiss) {
        contentStateRef.current.openToast(
          chrome.i18n.getMessage("pausedRecordingToast"),
          function () {}
        );
      }
    }, 100);
  });

  const resumeRecording = useCallback(() => {
    chrome.runtime.sendMessage({ type: "resume-recording-tab" });

    const now = Date.now();
    chrome.storage.local.get(["pausedAt", "totalPausedMs"], (s) => {
      const pausedAt = s.pausedAt || now;
      const totalPausedMs = s.totalPausedMs || 0;
      const additional = Math.max(0, now - pausedAt);

      chrome.storage.local.set({
        paused: false,
        pausedAt: null,
        totalPausedMs: totalPausedMs + additional,
      });
    });

    setContentState((prev) => ({
      ...prev,
      paused: false,
    }));
  });

  const dismissRecording = useCallback(() => {
    chrome.storage.local.set({ restarting: false });
    chrome.runtime.sendMessage({ type: "dismiss-recording-tab" });
    setContentState((prevContentState) => ({
      ...prevContentState,
      recording: false,
      paused: false,
      showExtension: false,
      timeWarning: false,
      showPopup: true,
      time: 0,
      timer: 0,
      tabCaptureFrame: false,
      pendingRecording: false,
      preparingRecording: false,
      blurMode: false,
      drawingMode: false,
    }));
    chrome.storage.local.set({
      paused: false,
      pausedAt: null,
      totalPausedMs: 0,
    });
    // Remove blur from all elements
    const elements = document.querySelectorAll(".screenity-blur");
    elements.forEach((element) => {
      element.classList.remove("screenity-blur");
    });
    setTimer(0);
  });

  const checkChromeCapturePermissions = useCallback(async () => {
    const permissions = ["desktopCapture", "alarms", "offscreen"];

    // Only request clipboardWrite if the user is logged in and subscribed
    if (
      contentStateRef.current?.isLoggedIn &&
      contentStateRef.current?.isSubscribed
    ) {
      permissions.push("clipboardWrite");
    }

    const containsPromise = new Promise((resolve) => {
      chrome.permissions.contains({ permissions }, (result) => {
        resolve(result);
      });
    });

    const result = await containsPromise;

    if (!result) {
      const requestPromise = new Promise((resolve) => {
        chrome.permissions.request({ permissions }, (granted) => {
          resolve(granted);
        });
      });

      const granted = await requestPromise;

      if (!granted) {
        return false;
      } else {
        chrome.runtime.sendMessage({ type: "add-alarm-listener" });
        return true;
      }
    } else {
      return true;
    }
  }, []);

  const checkChromeCapturePermissionsSW = useCallback(async () => {
    const { isLoggedIn, isSubscribed } = contentStateRef.current;

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "check-capture-permissions",
          isLoggedIn,
          isSubscribed,
        },
        (response) => {
          resolve(response.status === "ok");
        }
      );
    });
  }, []);

  const startStreaming = useCallback(async () => {
    // Set this early
    setContentState((prev) => ({
      ...prev,
      pendingRecording: true,
    }));

    let permission = false;

    if (
      contentStateRef.current?.isLoggedIn &&
      contentStateRef.current?.isSubscribed &&
      CLOUD_FEATURES_ENABLED
    ) {
      const storageResponse = await chrome.runtime.sendMessage({
        type: "check-storage-quota",
      });

      const { success, canUpload, error } = storageResponse;

      if (success && canUpload === false) {
        contentStateRef.current.openModal(
          chrome.i18n.getMessage("storageLimitReachedTitle"),
          chrome.i18n.getMessage("storageLimitReachedDescription"),
          chrome.i18n.getMessage("manageStorageButtonLabel"),
          chrome.i18n.getMessage("closeModalLabel"),
          () => {
            window.open(process.env.SCREENITY_APP_BASE, "_blank");
          },
          () => {}
        );
      } else if (!success) {
        const isSubError = error === "Subscription inactive";
        const isAuthError = error === "Not authenticated";

        // Update content state if subscription is inactive
        if (isSubError) {
          contentStateRef.current.setContentState((prev) => ({
            ...prev,
            isSubscribed: false,
          }));
        } else if (isAuthError) {
          contentStateRef.current.setContentState((prev) => ({
            ...prev,
            isSubscribed: false,
            isLoggedIn: false,
            screenityUser: null,
            proSubscription: null,
          }));
        }

        const message = isAuthError
          ? chrome.i18n.getMessage("storageCheckFailAuthDescription")
          : chrome.i18n.getMessage("storageCheckFailDescription");

        contentStateRef.current.openModal(
          chrome.i18n.getMessage("storageCheckFailTitle"),
          message,
          chrome.i18n.getMessage("retryButtonLabel"),
          chrome.i18n.getMessage("closeModalLabel"),
          async () => {
            window.location.reload(); // or retry logic
          },
          () => {}
        );
      }

      if (!success || (success && canUpload === false)) {
        setContentState((prev) => ({
          ...prev,
          pendingRecording: false,
          preparingRecording: false,
        }));
        return; // Stop recording setup
      }
    }

    // Check if in content script or extension page (Chrome)
    if (window.location.href.includes("chrome-extension://")) {
      permission = await checkChromeCapturePermissions();
    } else {
      permission = await checkChromeCapturePermissionsSW();
    }

    if (!permission) {
      contentStateRef.current.openModal(
        chrome.i18n.getMessage("chromePermissionsModalTitle"),
        chrome.i18n.getMessage("chromePermissionsModalDescription"),
        chrome.i18n.getMessage("chromePermissionsModalAction"),
        chrome.i18n.getMessage("chromePermissionsModalCancel"),
        async () => {
          await checkChromeCapturePermissionsSW();
          startStreaming(); // Retry streaming
        },
        () => {},
        null,
        chrome.i18n.getMessage("learnMoreDot"),
        URL,
        true
      );
      setContentState((prevContentState) => ({
        ...prevContentState,
        pendingRecording: false,
        preparingRecording: false,
      }));
      return;
    }

    const data = await chrome.runtime.sendMessage({ type: "available-memory" });

    if (
      data.quota < 524288000 &&
      !contentStateRef.current.isLoggedIn &&
      !contentStateRef.current.isSubscribed
    ) {
      if (typeof contentStateRef.current.openModal === "function") {
        let clear = null;
        let clearAction = () => {};
        const locale = chrome.i18n.getMessage("@@ui_locale");
        let helpURL =
          "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/what-does-%E2%80%9Cmemory-limit-reached%E2%80%9D-mean-when-recording/8WkwHbt3puuXunYqQnyPcb";

        if (!locale.includes("en")) {
          helpURL =
            "https://translate.google.com/translate?sl=en&tl=" +
            locale +
            "&u=https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/what-does-%E2%80%9Cmemory-limit-reached%E2%80%9D-mean-when-recording/8WkwHbt3puuXunYqQnyPcb";
        }

        const response = await chrome.runtime.sendMessage({
          type: "check-restore",
        });
        if (response.restore) {
          clear = chrome.i18n.getMessage("clearSpaceButton");
          clearAction = () => {
            chrome.runtime.sendMessage({ type: "clear-recordings" });
          };
        }

        contentStateRef.current.openModal(
          chrome.i18n.getMessage("notEnoughSpaceTitle"),
          chrome.i18n.getMessage("notEnoughSpaceDescription"),
          clear,
          chrome.i18n.getMessage("permissionsModalDismiss"),
          clearAction,
          () => {},
          null,
          chrome.i18n.getMessage("learnMoreDot"),
          helpURL
        );
      }
      setContentState((prevContentState) => ({
        ...prevContentState,
        pendingRecording: false,
        preparingRecording: false,
      }));
      return;
    }
    chrome.storage.local.set({
      tabRecordedID: null,
    });

    if (
      contentStateRef.current.recordingType === "region" &&
      contentStateRef.current.cropTarget
    ) {
      contentStateRef.current.regionCaptureRef.contentWindow.postMessage(
        {
          type: "crop-target",
          target: contentStateRef.current.cropTarget,
          width: contentStateRef.current.regionWidth,
          height: contentStateRef.current.regionHeight,
        },
        "*"
      );
    }

    setContentState((prevContentState) => ({
      ...prevContentState,
      showOnboardingArrow: false,
    }));

    if (
      !contentStateRef.current.micActive &&
      contentStateRef.current.askMicrophone
    ) {
      contentStateRef.current.openModal(
        chrome.i18n.getMessage("micMutedModalTitle"),
        chrome.i18n.getMessage("micMutedModalDescription"),
        chrome.i18n.getMessage("micMutedModalAction"),
        chrome.i18n.getMessage("micMutedModalCancel"),
        () => {
          chrome.runtime.sendMessage({
            type: "desktop-capture",
            region:
              contentStateRef.current.recordingType === "region" ? true : false,
            customRegion: contentStateRef.current.customRegion,
            offscreenRecording: contentStateRef.current.offscreenRecording,
            camera:
              contentStateRef.current.recordingType === "camera" ? true : false,
          });
          setContentState((prevContentState) => ({
            ...prevContentState,

            surface: "default",
            pipEnded: false,
          }));
        },
        () => {},
        false,
        false,
        false,
        false,
        chrome.i18n.getMessage("noShowAgain"),
        () => {
          setContentState((prevContentState) => ({
            ...prevContentState,
            askMicrophone: false,
          }));
          chrome.storage.local.set({ askMicrophone: false });
        }
      );
    } else {
      chrome.runtime.sendMessage({
        type: "desktop-capture",
        region:
          contentStateRef.current.recordingType === "region" ? true : false,
        customRegion: contentStateRef.current.customRegion,
        offscreenRecording: contentStateRef.current.offscreenRecording,
        camera:
          contentStateRef.current.recordingType === "camera" ? true : false,
      });
      setContentState((prevContentState) => ({
        ...prevContentState,

        surface: "default",
        pipEnded: false,
      }));
    }
  }, [contentState, contentStateRef]);

  const tryRestartRecording = useCallback(() => {
    contentState.pauseRecording();
    contentState.openModal(
      chrome.i18n.getMessage("restartModalTitle"),
      chrome.i18n.getMessage("restartModalDescription"),
      chrome.i18n.getMessage("restartModalRestart"),
      chrome.i18n.getMessage("restartModalResume"),
      () => {
        contentState.restartRecording();
      },
      () => {
        contentState.resumeRecording();
      }
    );
  });

  const tryDismissRecording = useCallback(() => {
    if (contentStateRef.current.askDismiss) {
      contentStateRef.current.pauseRecording(true);
      contentStateRef.current.openModal(
        chrome.i18n.getMessage("discardModalTitle"),
        chrome.i18n.getMessage("discardModalDescription"),
        chrome.i18n.getMessage("discardModalDiscard"),
        chrome.i18n.getMessage("discardModalResume"),
        () => {
          contentStateRef.current.dismissRecording();
        },
        () => {
          contentStateRef.current.resumeRecording();
        }
      );
    } else {
      contentStateRef.current.dismissRecording();
    }
  }, [contentState, contentStateRef.current]);

  const handleDevicePermissions = (data) => {
    if (data && data != undefined && data.success) {
      // I need to convert to a regular array of objects
      const audioInput = data.audioinput;
      const videoInput = data.videoinput;
      const cameraPermission = data.cameraPermission;
      const microphonePermission = data.microphonePermission;

      setContentState((prevContentState) => ({
        ...prevContentState,
        audioInput: audioInput,
        videoInput: videoInput,
        cameraPermission: cameraPermission,
        microphonePermission: microphonePermission,
      }));

      chrome.runtime.sendMessage({
        type: "switch-camera",
        id: contentStateRef.current.defaultVideoInput,
      });

      // Check if first time setting devices
      if (!contentStateRef.current.setDevices) {
        // Set default devices
        // Check if audio devices exist
        if (audioInput.length > 0) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            defaultAudioInput: audioInput[0].deviceId,
            micActive: true,
          }));
          chrome.storage.local.set({
            defaultAudioInput: audioInput[0].deviceId,
            micActive: true,
          });
        }
        if (videoInput.length > 0) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            defaultVideoInput: videoInput[0].deviceId,
            cameraActive: true,
          }));
          chrome.storage.local.set({
            defaultVideoInput: videoInput[0].deviceId,
            cameraActive: true,
          });
        }
        if (audioInput.length > 0 || videoInput.length > 0) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            setDevices: true,
          }));
          chrome.storage.local.set({
            setDevices: true,
          });
        }
      }
    } else {
      setContentState((prevContentState) => ({
        ...prevContentState,
        cameraPermission: false,
        microphonePermission: false,
      }));
      if (contentStateRef.current.askForPermissions) {
        contentStateRef.current.openModal(
          chrome.i18n.getMessage("permissionsModalTitle"),
          chrome.i18n.getMessage("permissionsModalDescription"),
          chrome.i18n.getMessage("permissionsModalDismiss"),
          chrome.i18n.getMessage("permissionsModalNoShowAgain"),
          () => {},
          () => {
            noMorePermissions();
          },
          chrome.runtime.getURL("assets/helper/permissions.webp"),
          chrome.i18n.getMessage("learnMoreDot"),
          URL2,
          true,
          false
        );
      }
    }
  };

  const noMorePermissions = useCallback(() => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      askForPermissions: false,
    }));
    chrome.storage.local.set({ askForPermissions: false });
  });

  useEffect(() => {
    const onChanged = (changes, area) => {
      if (area !== "local") return;

      if (changes.paused) {
        setContentState((prev) => ({
          ...prev,
          paused: Boolean(changes.paused.newValue),
        }));
      }
    };

    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === "screenity-permissions") {
        handleDevicePermissions(event.data);
      } else if (event.data.type === "screenity-permissions-loaded") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          permissionsLoaded: true,
        }));
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // These settings are available throughout the Content
  const [contentState, setContentStateInternal] = useState({
    color: "#4597F7",
    strokeWidth: 2,
    drawingMode: false,
    tool: "pen",
    undoStack: [],
    redoStack: [],
    canvas: null,
    swatch: 1,
    time: 0,
    timer: 0,
    recording: false,
    startRecording: startRecording,
    restartRecording: restartRecording,
    stopRecording: stopRecording,
    pauseRecording: pauseRecording,
    resumeRecording: resumeRecording,
    dismissRecording: dismissRecording,
    startStreaming: startStreaming,
    openModal: null,
    openToast: null,
    timeWarning: false,
    audioInput: [],
    videoInput: [],
    setDevices: false,
    defaultAudioInput: "none",
    defaultVideoInput: "none",
    cameraActive: false,
    micActive: false,
    sortBy: "newest",
    paused: false,
    toolbarPosition: {
      left: true,
      right: false,
      bottom: true,
      top: false,
      offsetX: 0,
      offsetY: 100,
    },
    popupPosition: {
      left: false,
      right: true,
      top: true,
      bottom: false,
      offsetX: 0,
      offsetY: 0,
      fixed: true,
    },
    cameraDimensions: {
      size: 200,
      x: 100,
      y: 100,
    },
    cameraFlipped: false,
    backgroundEffect: "blur",
    backgroundEffectsActive: false,
    countdown: true,
    showExtension: false,
    showPopup: false,
    blurMode: false,
    recordingType: "screen",
    customRegion: false,
    regionWidth: 800,
    surface: "default",
    regionHeight: 500,
    regionX: 100,
    regionY: 100,
    fromRegion: false,
    cropTarget: null,
    hideToolbar: false,
    alarm: false,
    alarmTime: 5 * 60,
    fromAlarm: false,
    pendingRecording: false,
    askForPermissions: true,
    cameraPermission: true,
    microphonePermission: true,
    askMicrophone: true,
    recordingShortcut: "⌥⇧W",
    recordingShortcut: "⌥⇧D",
    cursorMode: "none",
    shape: "rectangle",
    shapeFill: false,
    pushToTalk: false,
    zoomEnabled: false,
    offscreenRecording: false,
    isAddingImage: false,
    pipEnded: false,
    tabCaptureFrame: false,
    showOnboardingArrow: false,
    offline: false,
    updateChrome: false,
    permissionsChecked: false,
    permissionsLoaded: false,
    parentRef: null,
    shadowRef: null,
    settingsOpen: false,
    hideUIAlerts: false,
    toolbarHover: false,
    hideUI: false,
    bigTab: "record",
    askDismiss: true,
    quality: "max",
    systemAudio: true,
    backup: false,
    backupSetup: false,
    openWarning: false,
    hasOpenedBefore: false,
    qualityValue: "1080p",
    fpsValue: "30",
    countdownActive: false,
    countdownCancelled: false,
    multiMode: false,
    isCountdownVisible: false,
    multiSceneCount: 0,
    preparingRecording: false,
    wasLoggedIn: false,
    hasSeenInstantModeModal: false,
    instantMode: false,
    onboarding: false,
    showProSplash: false,
    hasSubscribedBefore: false,
    startRecordingAfterCountdown: () => {
      playBeepSound();
      setTimeout(() => {
        if (!contentStateRef.current.countdownCancelled) {
          contentStateRef.current.startRecording();
        }
      }, 500);
    },
    cancelCountdown: () => {
      setContentState((prev) => ({
        ...prev,
        countdownActive: false,
        countdownCancelled: true,
        isCountdownVisible: false,
        recording: false,
        showPopup: true,
        showExtension: true,
      }));
      // Call dismissRecording to ensure everything is properly cleaned up
      contentStateRef.current.dismissRecording();
    },
    resetCountdown: () => {
      setContentState((prev) => ({
        ...prev,
        countdownCancelled: false,
      }));
    },
  });
  contentStateRef.current = contentState;

  setContentState = (updater) => {
    if (typeof updater === "function") {
      setContentStateInternal((prevState) => {
        const newState = updater(prevState);
        contentStateRef.current = newState;
        return newState;
      });
    } else {
      setContentStateInternal(updater);
      contentStateRef.current = updater;
    }
  };

  const playBeepSound = () => {
    const audio = new Audio(chrome.runtime.getURL("/assets/sounds/beep2.mp3"));
    audio.volume = 0.5;
    audio.play();
  };

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "sync-recording-state" }, (state) => {
      if (!state) return;
      setContentState((prev) => ({ ...prev, ...state }));
    });
  }, []);

  useEffect(() => {
    if (!CLOUD_FEATURES_ENABLED) return;
    if (!contentState.isLoggedIn || !contentState.isSubscribed) return;

    chrome.storage.local.get(["firstTimePro"], (res) => {
      if (
        res.firstTimePro &&
        typeof contentStateRef.current?.openModal === "function"
      ) {
        setTimeout(() => {
          contentStateRef.current.openModal(
            chrome.i18n.getMessage("welcomeToProTitleModal"),
            chrome.i18n.getMessage("welcomeToProDescriptionModal"),
            chrome.i18n.getMessage("welcomeToProActionModal"),
            null,
            () => {
              chrome.storage.local.set({ firstTimePro: false });
            }
          );
        }, 300);
      }
    });
  }, [contentState?.isLoggedIn, contentState?.isSubscribed]);

  // Check Chrome version
  useEffect(() => {
    const version = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);

    const MIN_CHROME_VERSION = 109;

    if (version && parseInt(version[2], 10) < MIN_CHROME_VERSION) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        updateChrome: true,
      }));
    }
  }, []);

  useEffect(() => {
    if (typeof contentState.openWarning === "function") {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const warningList = [
        "youtube.com",
        "meet.google.com",
        "zoom.us",
        "hangouts.google.com",
        "teams.microsoft.com",
        "web.whatsapp.com",
        "web.skype.com",
        "discord.com",
        "vimeo.com",
      ];

      if (
        !contentState.recording &&
        isMac &&
        warningList.some((el) => window.location.href.includes(el)) &&
        contentState.recordingType != "region" &&
        contentState.recordingType != "camera"
      ) {
        contentState.openWarning(
          chrome.i18n.getMessage("audioWarningTitle"),
          chrome.i18n.getMessage(
            "audioWarningDescription",
            chrome.i18n.getMessage("tabType")
          ),
          "AudioIcon",
          10000
        );
        // Check if url contains "playground.html" and "chrome-extension://"
      } else if (
        window.location.href.includes("playground.html") &&
        window.location.href.includes("chrome-extension://") &&
        !contentState.recording
      ) {
        contentState.openWarning(
          chrome.i18n.getMessage("extensionNotSupportedTitle"),
          chrome.i18n.getMessage("extensionNotSupportedDescription"),
          "NotSupportedIcon",
          10000
        );
      }
    }
  }, [
    contentState.openWarning,
    contentState.recording,
    contentState.recordingType,
  ]);

  useEffect(() => {
    if (!contentState) return;
    if (typeof contentState.openModal === "function") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        tryRestartRecording: tryRestartRecording,
        tryDismissRecording: tryDismissRecording,
      }));
    }
  }, [contentState.openModal]);

  // Count up every second
  useEffect(() => {
    if (contentState.recording && !contentState.paused && !contentState.alarm) {
      setTimer((timer) => timer + 1);
      const interval = setInterval(() => {
        setTimer((timer) => timer + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (
      contentState.alarm &&
      !contentState.paused &&
      contentState.recording &&
      contentState.timer > 0
    ) {
      const interval = setInterval(() => {
        setTimer((timer) => timer - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [contentState.recording, contentState.paused]);

  useEffect(() => {
    if (!contentState.customRegion) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        cropTarget: null,
      }));
    }
  }, [contentState.customRegion]);

  // Check when hiding the toolbar
  useEffect(() => {
    if (contentState.hideToolbar && contentState.hideUI) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        drawingMode: false,
        blurMode: false,
      }));
    }
  }, [contentState.hideToolbar, contentState.hideUI]);

  useEffect(() => {
    setupHandlers();
  }, []);

  useEffect(() => {
    chrome.storage.local.set({
      pendingRecording: contentState.pendingRecording,
    });
  }, [contentState.pendingRecording]);

  // Check if user has enough RAM to record for each quality option
  useEffect(() => {
    if (!contentState.qualityValue) {
      const suggested = "1080p"; // safe and high enough quality
      setContentState((prev) => ({ ...prev, qualityValue: suggested }));
      chrome.storage.local.set({ qualityValue: suggested });
    }
  }, []);

  // Check recording start time
  useEffect(() => {
    chrome.storage.local.get(["recordingStartTime"], (result) => {
      if (result.recordingStartTime && contentStateRef.current.recording) {
        const recordingStartTime = result.recordingStartTime;
        const currentTime = new Date().getTime();
        const timeElapsed = currentTime - recordingStartTime;
        const timeElapsedSeconds = Math.floor(timeElapsed / 1000);
        if (contentState.alarm) {
          setTimer(contentState.alarmTime - timeElapsedSeconds);
        } else {
          setTimer(timeElapsedSeconds);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (contentState.pushToTalk) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        micActive: false,
      }));

      chrome.storage.local.set({
        micActive: false,
      });

      chrome.runtime.sendMessage({
        type: "set-mic-active-tab",
        active: false,
        defaultAudioInput: contentState.defaultAudioInput,
      });
    }
  }, [contentState.pushToTalk]);

  useEffect(() => {
    if (contentState.backgroundEffectsActive) {
      chrome.runtime.sendMessage({ type: "background-effects-active" });
    } else {
      chrome.runtime.sendMessage({ type: "background-effects-inactive" });
    }
  }, [contentState.backgroundEffectsActive]);

  useEffect(() => {
    if (contentState.backgroundEffectsActive) {
      chrome.runtime.sendMessage({
        type: "set-background-effect",
        effect: contentState.backgroundEffect,
      });
    }
  }, [contentState.backgroundEffect, contentState.backgroundEffectsActive]);

  // Programmatically add custom scrollbars
  useEffect(() => {
    if (!contentState.parentRef) return;

    // Check if on mac
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    if (isMac) return;

    const parentDiv = contentState.parentRef;

    const elements = parentDiv.querySelectorAll("*");
    elements.forEach((element) => {
      element.classList.add("screenity-scrollbar");
    });

    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);

          addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node.classList.add("screenity-scrollbar");
            }
          });

          removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node.classList.remove("screenity-scrollbar");
            }
          });
        }
      }
    });

    observer.observe(parentDiv, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [contentState.parentRef]);

  // Programmatically add custom scrollbars
  useEffect(() => {
    if (!contentState.shadowRef) return;

    // Check if on mac
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    if (isMac) return;

    const shadowRoot = contentState.shadowRef.shadowRoot;

    const elements = shadowRoot.querySelectorAll("*");
    elements.forEach((element) => {
      element.classList.add("screenity-scrollbar");
    });

    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);

          addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node.classList.add("screenity-scrollbar");
            }
          });

          removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node.classList.remove("screenity-scrollbar");
            }
          });
        }
      }
    });

    observer.observe(shadowRoot, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [
    contentState.parentRef,
    contentState.shadowRef,
    contentState.bigTab,
    contentState.recordingType,
  ]);

  useEffect(() => {
    if (!contentState.hideUI) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        hideUIAlerts: false,
        hideToolbar: false,
        toolbarHover: false,
      }));
    }
  }, [contentState.hideUI]);

  useEffect(() => {
    updateFromStorage();
  }, []);

  return (
    // this is the provider providing state
    <contentStateContext.Provider
      value={[contentState, setContentState, timer, setTimer]}
    >
      {props.children}
      <Shortcuts shortcuts={contentState.shortcuts} />
    </contentStateContext.Provider>
  );
};

export default ContentState;
