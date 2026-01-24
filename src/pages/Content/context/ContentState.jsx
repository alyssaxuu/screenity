import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

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

const CURSOR_EFFECTS = ["target", "highlight", "spotlight"];

const normalizeCursorEffects = (effects) => {
  if (!Array.isArray(effects)) return [];
  return effects.filter((effect) => CURSOR_EFFECTS.includes(effect));
};

const deriveCursorMode = (effects, fallbackMode) => {
  if (effects.length === 0) return "none";
  if (effects.length === 1) return effects[0];
  if (fallbackMode && effects.includes(fallbackMode)) return fallbackMode;
  return effects[0] || "none";
};

const ContentState = (props) => {
  const [timer, setTimerInternal] = React.useState(0);
  const CLOUD_FEATURES_ENABLED =
    process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";
  setTimer = setTimerInternal;
  const [URL, setURL] = useState(
    "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/why-does-screenity-ask-for-permissions/9AAE8zJ6iiUtCAtjn4SUT1",
  );
  const [URL2, setURL2] = useState(
    "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/how-to-grant-screenity-permission-to-record-your-camera-and-microphone/x6U69TnrbMjy5CQ96Er2E9",
  );
  const startBeepRef = useRef(null);
  const stopBeepRef = useRef(null);
  const prevRecordingRef = useRef(null);
  const hydratedRef = useRef(false);
  const suppressStopBeepRef = useRef(false);
  const suppressStartBeepRef = useRef(false);
  const tabIdRef = useRef(null);
  const activeTabRef = useRef(null);
  const tabRecordedIdRef = useRef(null);

  const isTargetTab = useCallback(() => {
    const tabId = tabIdRef.current;
    const tabRecordedID = tabRecordedIdRef.current;
    const activeTab = activeTabRef.current;

    if (tabRecordedID != null) {
      return tabId != null && tabId === tabRecordedID;
    }
    if (activeTab != null) {
      return tabId != null && tabId === activeTab;
    }
    return true;
  }, []);

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
    chrome.runtime.sendMessage({ type: "get-tab-id" }, (response) => {
      if (response?.tabId !== undefined && response?.tabId !== null) {
        tabIdRef.current = response.tabId;
      }
    });

    chrome.storage.local.get(["activeTab", "tabRecordedID"], (result) => {
      activeTabRef.current = result.activeTab ?? null;
      tabRecordedIdRef.current = result.tabRecordedID ?? null;
    });
  }, []);

  useEffect(() => {
    const locale = chrome.i18n.getMessage("@@ui_locale");
    if (!locale.includes("en")) {
      setURL(
        "https://translate.google.com/translate?sl=en&tl=" +
          locale +
          "&u=https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/why-does-screenity-ask-for-permissions/9AAE8zJ6iiUtCAtjn4SUT1",
      );
      setURL2(
        "https://translate.google.com/translate?sl=en&tl=" +
          locale +
          "&u=https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/how-to-grant-screenity-permission-to-record-your-camera-and-microphone/x6U69TnrbMjy5CQ96Er2E9",
      );
    }
  }, []);

  const startRecording = useCallback(() => {
    const shouldClearCountdown =
      !contentStateRef.current?.isCountdownVisible &&
      !contentStateRef.current?.countdownActive;
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
      ...(shouldClearCountdown
        ? { countdownActive: false, isCountdownVisible: false }
        : {}),
    }));
    chrome.storage.local.set({ restarting: false });

    // This cannot be triggered from here because the user might not have the page focused
    //chrome.runtime.sendMessage({ type: "start-recording" });
  }, []);

  const restartRecording = useCallback(() => {
    chrome.storage.local.set({ restarting: true });
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
          "*",
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
      restarting: false,
      tabRecordedID: null,
      drawingMode: false,
      blurMode: false,
      cursorMode: "none",
      cursorEffects: [],
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
      drawingMode: false,
      blurMode: false,
      toolbarMode: "",
      cursorMode: "none",
      cursorEffects: [],
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
  });

  const pauseRecording = useCallback((dismiss) => {
    if (contentStateRef.current?.paused) return;
    chrome.runtime.sendMessage({ type: "pause-recording-tab" });

    setTimeout(() => {
      setContentState((prev) => ({
        ...prev,
        paused: true,
      }));
      if (!dismiss) {
        contentStateRef.current.openToast(
          chrome.i18n.getMessage("pausedRecordingToast"),
          function () {},
        );
      }
    }, 100);
  });

  const resumeRecording = useCallback(() => {
    if (!contentStateRef.current?.paused) return;
    chrome.runtime.sendMessage({ type: "resume-recording-tab" });

    setContentState((prev) => ({
      ...prev,
      paused: false,
    }));
  });

  const dismissRecording = useCallback(() => {
    suppressStopBeepRef.current = true;
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
        },
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
          () => {},
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
          () => {},
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
        true,
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
          helpURL,
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
        "*",
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
        },
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
      },
    );
  });

  const tryDismissRecording = useCallback(() => {
    if (contentStateRef.current.askDismiss) {
      if (!contentStateRef.current.paused) {
        contentStateRef.current.pauseRecording(true);
      }
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
        },
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

      const audioInputById = Array.isArray(audioInput)
        ? Object.fromEntries(
            audioInput.map((device) => [device.deviceId, device.label]),
          )
        : {};
      const videoInputById = Array.isArray(videoInput)
        ? Object.fromEntries(
            videoInput.map((device) => [device.deviceId, device.label]),
          )
        : {};

      const defaultAudioInputLabel =
        audioInputById[contentStateRef.current.defaultAudioInput] || "";
      const defaultVideoInputLabel =
        videoInputById[contentStateRef.current.defaultVideoInput] || "";

      setContentState((prevContentState) => ({
        ...prevContentState,
        defaultAudioInputLabel:
          defaultAudioInputLabel || prevContentState.defaultAudioInputLabel,
        defaultVideoInputLabel:
          defaultVideoInputLabel || prevContentState.defaultVideoInputLabel,
      }));

      chrome.storage.local.set({
        defaultAudioInputLabel:
          defaultAudioInputLabel ||
          contentStateRef.current.defaultAudioInputLabel,
        defaultVideoInputLabel:
          defaultVideoInputLabel ||
          contentStateRef.current.defaultVideoInputLabel,
      });

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
            defaultAudioInputLabel: audioInput[0].label || "",
            micActive: true,
          }));
          chrome.storage.local.set({
            defaultAudioInput: audioInput[0].deviceId,
            defaultAudioInputLabel: audioInput[0].label || "",
            micActive: true,
          });
        }
        if (videoInput.length > 0) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            defaultVideoInput: videoInput[0].deviceId,
            defaultVideoInputLabel: videoInput[0].label || "",
            cameraActive: true,
          }));
          chrome.storage.local.set({
            defaultVideoInput: videoInput[0].deviceId,
            defaultVideoInputLabel: videoInput[0].label || "",
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
          false,
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
    setToolbarMode: null,
    openModal: null,
    openToast: null,
    timeWarning: false,
    audioInput: [],
    videoInput: [],
    setDevices: false,
    defaultAudioInput: "none",
    defaultVideoInput: "none",
    defaultAudioInputLabel: "",
    defaultVideoInputLabel: "",
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
    toggleDrawingModeShortcut: "",
    toggleBlurModeShortcut: "",
    toggleCursorModeShortcut: "",
    cursorMode: "none",
    cursorEffects: [],
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
      if (!contentStateRef.current.countdownCancelled) {
        contentStateRef.current.startRecording();
      }
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
    onCountdownFinished: () => {
      if (!contentStateRef.current?.countdownCancelled && isTargetTab()) {
        suppressStartBeepRef.current = true;
        playBeep(startBeepRef, "assets/sounds/beep2.mp3");
      }
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

  const playBeep = (ref, filename) => {
    if (!ref.current) {
      ref.current = new Audio(chrome.runtime.getURL(filename));
    }
    const audio = ref.current;
    audio.volume = 0.5;
    try {
      audio.currentTime = 0;
    } catch {}
    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch((error) => {
        console.warn("Beep playback failed:", error);
      });
    }
  };

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "sync-recording-state" }, (state) => {
      if (!state) return;
      setContentState((prev) => ({ ...prev, ...state }));
      setTimeout(() => {
        hydratedRef.current = true;
        prevRecordingRef.current = Boolean(state.recording);
      }, 0);
    });
  }, []);

  useEffect(() => {
    const isRecording = Boolean(contentState.recording);
    if (!hydratedRef.current) {
      prevRecordingRef.current = isRecording;
      return;
    }
    if (prevRecordingRef.current === null) {
      prevRecordingRef.current = isRecording;
      return;
    }
    if (!isTargetTab()) {
      prevRecordingRef.current = isRecording;
      return;
    }

    if (prevRecordingRef.current === false && isRecording === true) {
      if (suppressStartBeepRef.current) {
        suppressStartBeepRef.current = false;
      } else {
        playBeep(startBeepRef, "assets/sounds/beep2.mp3");
      }
    } else if (prevRecordingRef.current === true && isRecording === false) {
      if (suppressStopBeepRef.current) {
        suppressStopBeepRef.current = false;
      } else {
        playBeep(stopBeepRef, "assets/sounds/beep.mp3");
      }
    }

    prevRecordingRef.current = isRecording;
  }, [contentState.recording, isTargetTab]);

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
            },
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
            chrome.i18n.getMessage("tabType"),
          ),
          "AudioIcon",
          10000,
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
          10000,
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

  const updateTimerFromStorage = useCallback(async () => {
    const { recording, recordingStartTime, paused, pausedAt, totalPausedMs } =
      await chrome.storage.local.get([
        "recording",
        "recordingStartTime",
        "paused",
        "pausedAt",
        "totalPausedMs",
      ]);

    if (!recording || !recordingStartTime) {
      setTimer(0);
      return;
    }

    const now = Date.now();
    const basePaused = totalPausedMs || 0;
    const extraPaused = paused && pausedAt ? Math.max(0, now - pausedAt) : 0;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now - recordingStartTime - basePaused - extraPaused) / 1000),
    );

    if (contentStateRef.current?.alarm) {
      const alarmTime = contentStateRef.current?.alarmTime || 0;
      setTimer(Math.max(0, alarmTime - elapsedSeconds));
      return;
    }

    setTimer((prev) => {
      if (!Number.isFinite(prev)) {
        return elapsedSeconds;
      }
      if (elapsedSeconds <= prev) {
        return elapsedSeconds;
      }
      const delta = elapsedSeconds - prev;
      if (delta <= 1) {
        return elapsedSeconds;
      }
      if (delta <= 3) {
        return prev + 1;
      }
      return elapsedSeconds;
    });
  }, []);

  useEffect(() => {
    updateTimerFromStorage();
    const interval = setInterval(() => {
      updateTimerFromStorage();
    }, 1000);
    return () => clearInterval(interval);
  }, [updateTimerFromStorage]);

  useEffect(() => {
    const onChanged = (changes, area) => {
      if (area !== "local") return;

      if (changes.activeTab) {
        activeTabRef.current = changes.activeTab.newValue ?? null;
      }
      if (changes.tabRecordedID) {
        tabRecordedIdRef.current = changes.tabRecordedID.newValue ?? null;
      }
      if (changes.paused) {
        setContentState((prev) => ({
          ...prev,
          paused: Boolean(changes.paused.newValue),
        }));
      }
      if (changes.recording) {
        const isRecording = Boolean(changes.recording.newValue);
        if (isRecording && !isTargetTab()) {
          setContentState((prev) => ({
            ...prev,
            recording: false,
          }));
          return;
        }
        const shouldHideCountdown =
          isRecording &&
          !contentStateRef.current?.isCountdownVisible &&
          !contentStateRef.current?.countdownActive;
        setContentState((prev) => ({
          ...prev,
          recording: isRecording,
          ...(shouldHideCountdown
            ? {
                countdownActive: false,
                isCountdownVisible: false,
              }
            : {}),
        }));
      }
      if (changes.cursorEffects) {
        const nextEffects = normalizeCursorEffects(
          changes.cursorEffects.newValue,
        );
        const fallbackMode =
          changes.cursorMode?.newValue ||
          contentStateRef.current?.cursorMode ||
          "none";
        const nextMode = deriveCursorMode(nextEffects, fallbackMode);
        setContentState((prev) => ({
          ...prev,
          cursorEffects: nextEffects,
          cursorMode: nextMode,
        }));
      } else if (changes.cursorMode) {
        const mode = changes.cursorMode.newValue || "none";
        const fallbackEffects = mode !== "none" ? [mode] : [];
        setContentState((prev) => ({
          ...prev,
          cursorMode: mode,
          cursorEffects:
            Array.isArray(prev.cursorEffects) && prev.cursorEffects.length > 0
              ? prev.cursorEffects
              : fallbackEffects,
        }));
      }
      if (
        changes.paused ||
        changes.recording ||
        changes.recordingStartTime ||
        changes.pausedAt ||
        changes.totalPausedMs
      ) {
        updateTimerFromStorage();
      }
    };

    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [isTargetTab, updateTimerFromStorage]);

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
    if (window.__screenitySetupHandlersInitialized) return;
    window.__screenitySetupHandlersInitialized = true;
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
