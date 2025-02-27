import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";

// Shortcuts
import Shortcuts from "../shortcuts/Shortcuts";

//create a context, with createContext api
export const contentStateContext = createContext();

const ContentState = (props) => {
  const [timer, setTimer] = React.useState(0);
  const contentStateRef = useRef();
  const [URL, setURL] = useState(
    "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/why-does-screenity-ask-for-permissions/9AAE8zJ6iiUtCAtjn4SUT1"
  );
  const [URL2, setURL2] = useState(
    "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/how-to-grant-screenity-permission-to-record-your-camera-and-microphone/x6U69TnrbMjy5CQ96Er2E9"
  );

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
      pendingRecording: false,
    }));
    chrome.storage.local.set({
      recording: true,
      restarting: false,
    });

    // This cannot be triggered from here because the user might not have the page focused
    //chrome.runtime.sendMessage({ type: "start-recording" });
  }, [contentStateRef.current]);

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
  }, [contentStateRef.current]);

  const stopRecording = useCallback(() => {
    chrome.storage.local.set({
      recording: false,
      restarting: false,
      tabRecordedID: null,
    });
    setContentState((prevContentState) => ({
      ...prevContentState,
      recording: false,
      paused: false,
      showExtension: false,
      showPopup: true,
      pendingRecording: false,
      tabCaptureFrame: false,
      time: 0,
      timer: 0,
    }));
    setTimer(0);
    chrome.runtime.sendMessage({ type: "stop-recording-tab" });
    // Play beep sound at 50% volume
    const audio = new Audio(chrome.runtime.getURL("/assets/sounds/beep.mp3"));
    audio.volume = 0.5;
    audio.play();
  });

  const pauseRecording = useCallback((dismiss) => {
    chrome.runtime.sendMessage({ type: "pause-recording-tab" });

    setTimeout(() => {
      setContentState((prevContentState) => ({
        ...prevContentState,
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
    setContentState((prevContentState) => ({
      ...prevContentState,
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
      showPopup: true,
      time: 0,
      timer: 0,
      tabCaptureFrame: false,
      pendingRecording: false,
    }));
    setTimer(0);
  });

  const checkChromeCapturePermissions = useCallback(async () => {
    const containsPromise = new Promise((resolve) => {
      chrome.permissions.contains(
        {
          permissions: ["desktopCapture", "alarms", "offscreen"],
        },
        (result) => {
          resolve(result);
        }
      );
    });

    const result = await containsPromise;

    if (!result) {
      const requestPromise = new Promise((resolve) => {
        chrome.permissions.request(
          {
            permissions: ["desktopCapture", "alarms", "offscreen"],
          },
          (granted) => {
            resolve(granted);
          }
        );
      });

      const granted = await requestPromise;

      if (!granted) {
        return false;
      } else {
        chrome.runtime.sendMessage({
          type: "add-alarm-listener",
        });
        return true;
      }
    } else {
      return true;
    }
  }, []);

  const checkChromeCapturePermissionsSW = useCallback(async () => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "check-capture-permissions",
        },
        (response) => {
          if (response.status === "ok") {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      );
    });
  }, []);

  const startStreaming = useCallback(async () => {
    chrome.runtime
      .sendMessage({ type: "available-memory" })
      .then(async (data) => {
        // Check if there's enough space to keep recording
        if (data.quota < 524288000) {
          if (typeof contentStateRef.current.openModal === "function") {
            let clear = null;
            let clearAction = () => {};
            // Add help link to modal
            const locale = chrome.i18n.getMessage("@@ui_locale");
            let helpURL =
              "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/what-does-%E2%80%9Cmemory-limit-reached%E2%80%9D-mean-when-recording/8WkwHbt3puuXunYqQnyPcb";

            if (!locale.includes("en")) {
              helpURL =
                "https://translate.google.com/translate?sl=en&tl=" +
                locale +
                "&u=https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/what-does-%E2%80%9Cmemory-limit-reached%E2%80%9D-mean-when-recording/8WkwHbt3puuXunYqQnyPcb";
            }

            // Check if chunks collection exists and has data
            chrome.runtime
              .sendMessage({ type: "check-restore" })
              .then((response) => {
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
              });
          }
        } else {
          // Check if recording a region & if a custom region is set
          if (
            contentStateRef.current.recordingType === "region" &&
            contentStateRef.current.cropTarget
          ) {
            contentStateRef.current.regionCaptureRef.contentWindow.postMessage(
              {
                type: "crop-target",
                target: contentStateRef.current.cropTarget,
              },
              "*"
            );
          }

          let permission = false;
          // Check if is in a content script vs an extension page (Chrome)
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
                startStreaming();
              },
              () => {},
              null,
              chrome.i18n.getMessage("learnMoreDot"),
              URL,
              true
            );
            return;
          }

          chrome.storage.local.set({
            tabRecordedID: null,
          });

          if (
            contentStateRef.current.recordingType === "region" &&
            !contentStateRef.current.customRegion
          ) {
            setContentState((prevContentState) => ({
              ...prevContentState,
              tabCaptureFrame: true,
            }));
          }

          setContentState((prevContentState) => ({
            ...prevContentState,
            showOnboardingArrow: false,
          }));

          // Show modal if microphone is not enabled
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
                    contentStateRef.current.recordingType === "region"
                      ? true
                      : false,
                  customRegion: contentStateRef.current.customRegion,
                  offscreenRecording:
                    contentStateRef.current.offscreenRecording,
                  camera:
                    contentStateRef.current.recordingType === "camera"
                      ? true
                      : false,
                });
                setContentState((prevContentState) => ({
                  ...prevContentState,
                  pendingRecording: true,
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
                chrome.runtime.sendMessage({
                  type: "desktop-capture",
                  region:
                    contentStateRef.current.recordingType === "region"
                      ? true
                      : false,
                  customRegion: contentStateRef.current.customRegion,
                  offscreenRecording:
                    contentStateRef.current.offscreenRecording,
                  camera:
                    contentStateRef.current.recordingType === "camera"
                      ? true
                      : false,
                });
                setContentState((prevContentState) => ({
                  ...prevContentState,
                  pendingRecording: true,
                  surface: "default",
                  pipEnded: false,
                }));
              }
            );
          } else {
            chrome.runtime.sendMessage({
              type: "desktop-capture",
              region:
                contentStateRef.current.recordingType === "region"
                  ? true
                  : false,
              customRegion: contentStateRef.current.customRegion,
              offscreenRecording: contentStateRef.current.offscreenRecording,
              camera:
                contentStateRef.current.recordingType === "camera"
                  ? true
                  : false,
            });
            setContentState((prevContentState) => ({
              ...prevContentState,
              pendingRecording: true,
              surface: "default",
              pipEnded: false,
            }));
          }
        }
      });
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
        // false,
        // false,
        // false,
        // false,
        // chrome.i18n.getMessage("noShowAgain"),
        // () => {
        //   setContentState((prevContentState) => ({
        //     ...prevContentState,
        //     askDismiss: false,
        //   }));
        //   chrome.storage.local.set({ askDismiss: false });
        //   contentState.dismissRecording();
        // }
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
  const [contentState, setContentState] = useState({
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
    audioInput: [],
    videoInput: [],
    setDevices: false,
    defaultAudioInput: "none",
    defaultVideoInput: "none",
    cameraActive: false,
    micActive: false,
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
    qualityValue: "720p",
    fpsValue: "30",
  });
  contentStateRef.current = contentState;

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

  // Check if offline or online (event)
  // useEffect(() => {
  //   const handleOffline = () => {
  //     setContentState((prevContentState) => ({
  //       ...prevContentState,
  //       offline: true,
  //     }));
  //   };

  //   const handleOnline = () => {
  //     setContentState((prevContentState) => ({
  //       ...prevContentState,
  //       offline: false,
  //     }));
  //   };

  //   window.addEventListener("offline", handleOffline);
  //   window.addEventListener("online", handleOnline);

  //   return () => {
  //     window.removeEventListener("offline", handleOffline);
  //     window.removeEventListener("online", handleOnline);
  //   };
  // }, []);

  // useEffect(() => {
  //   if (!navigator.onLine) {
  //     setContentState((prevContentState) => ({
  //       ...prevContentState,
  //       offline: true,
  //     }));
  //   }
  // }, []);

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

  const onMessage = useCallback(
    (request, sender, sendResponse) => {
      if (request.type === "time") {
        chrome.storage.local.get(["recording"], (result) => {
          if (result.recording) {
            setTimer(request.time);
          }
        });
      } else if (request.type === "toggle-popup") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          showExtension: !prevContentState.showExtension,
          hasOpenedBefore: true,
          showPopup: true,
        }));
        setTimer(0);
        updateFromStorage();
      } else if (request.type === "ready-to-record") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          showPopup: false,
        }));
      } else if (request.type === "stop-recording-tab") {
        chrome.storage.local.set({ recording: false });
        setContentState((prevContentState) => ({
          ...prevContentState,
          recording: false,
          paused: false,
          showExtension: false,
          showPopup: true,
        }));
      } else if (request.type === "recording-ended") {
        if (
          !contentStateRef.current.showPopup &&
          !contentStateRef.current.pendingRecording
        ) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            showExtension: false,
            recording: false,
            paused: false,
            time: 0,
            timer: 0,
          }));
        }
      } else if (request.type === "recording-error") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          pendingRecording: false,
        }));
      } else if (request.type === "start-stream") {
        if (contentStateRef.current.recording) return;

        // Make sure the extension + popup is visible
        setContentState((prevContentState) => ({
          ...prevContentState,
          showExtension: true,
          showPopup: true,
        }));

        // Check if recording type is camera, if no camera is set, show the camera picker
        if (contentStateRef.current.recordingType != "camera") {
          contentStateRef.current.startStreaming();
        } else if (
          contentStateRef.current.defaultVideoInput != "none" &&
          contentStateRef.current.cameraActive
        ) {
          contentStateRef.current.startStreaming();
        }
      } else if (request.type === "commands") {
        // Find the command with the name "start-recording"
        const startRecordingCommand = request.commands.find(
          (command) => command.name === "start-recording"
        );
        const cancelRecordingCommand = request.commands.find(
          (command) => command.name === "cancel-recording"
        );
        setContentState((prevContentState) => ({
          ...prevContentState,
          recordingShortcut: startRecordingCommand.shortcut,
          dismissRecordingShortcut: cancelRecordingCommand.shortcut,
        }));
      } else if (request.type === "cancel-recording") {
        contentState.dismissRecording();
      } else if (request.type === "pause-recording") {
        // Toggle pause / resume
        if (contentStateRef.current.paused) {
          contentState.resumeRecording();
        } else {
          contentState.pauseRecording();
        }
      } else if (request.type === "set-surface") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          surface: request.surface,
        }));
      } else if (request.type === "pip-ended") {
        if (
          contentStateRef.current.recording ||
          contentStateRef.current.pendingRecording
        ) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            pipEnded: true,
          }));
        }
      } else if (request.type === "pip-started") {
        if (
          contentStateRef.current.recording ||
          contentStateRef.current.pendingRecording
        ) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            pipEnded: false,
          }));
        }
      } else if (request.type === "setup-complete") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          showOnboardingArrow: true,
        }));
      } else if (request.type === "hide-popup-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          showPopup: false,
          showExtension: false,
        }));
      } else if (request.type === "stream-error") {
        contentStateRef.current.openModal(
          chrome.i18n.getMessage("streamErrorModalTitle"),
          chrome.i18n.getMessage("streamErrorModalDescription"),
          chrome.i18n.getMessage("permissionsModalDismiss"),
          null,
          () => {
            contentStateRef.current.dismissRecording();
          },
          () => {
            contentStateRef.current.dismissRecording();
          }
        );
      } else if (request.type === "backup-error") {
        contentStateRef.current.openModal(
          chrome.i18n.getMessage("backupPermissionFailTitle"),
          chrome.i18n.getMessage("backupPermissionFailDescription"),
          chrome.i18n.getMessage("permissionsModalDismiss"),
          null,
          () => {
            contentStateRef.current.dismissRecording();
          },
          () => {
            contentStateRef.current.dismissRecording();
          }
        );
      } else if (request.type === "recording-check") {
        if (!request.force) {
          if (!contentStateRef.showExtension && !contentStateRef.recording) {
            updateFromStorage(true, sender.id);
          }
        } else if (request.force) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            showExtension: true,
            recording: true,
          }));
          //checkRecording(sender.tab.id);
          updateFromStorage(false, sender.id);
        }
      } else if (request.type === "stop-pending") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          pendingRecording: false,
        }));
      }
    },
    [contentStateRef.current, contentState]
  );

  useEffect(() => {
    chrome.storage.local.set({
      pendingRecording: contentState.pendingRecording,
    });
  }, [contentState.pendingRecording]);

  // Check if user has enough RAM to record for each quality option
  useEffect(() => {
    const checkRAM = () => {
      let width = Math.round(window.screen.width * window.devicePixelRatio);
      let height = Math.round(window.screen.height * window.devicePixelRatio);
      const ram = navigator.deviceMemory;

      // Check if ramValue needs to be updated
      if (
        (ram < 2 || width < 1280 || height < 720) &&
        (contentState.qualityValue === "720p" ||
          contentState.qualityValue === "4k" ||
          contentState.qualityValue === "1080p")
      ) {
        setContentState((prevContentState) => ({
          ...prevContentState,
          qualityValue: "480p",
        }));
        chrome.storage.local.set({
          qualityValue: "480p",
        });
      } else if (
        (ram < 8 || width < 3840 || height < 2160) &&
        contentState.qualityValue === "4k"
      ) {
        setContentState((prevContentState) => ({
          ...prevContentState,
          qualityValue: "720p",
        }));
        chrome.storage.local.set({
          qualityValue: "720p",
        });
      }
    };
    checkRAM();
  }, [contentState.qualityValue]);

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

  // Event handler
  useEffect(() => {
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

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

  const checkRecording = async (id) => {
    const { recording } = await chrome.storage.local.get("recording");
    const { tabRecordedID } = await chrome.storage.local.get("tabRecordedID");
    if (id == null && tabRecordedID) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        recording: false,
      }));
    } else if (recording && tabRecordedID) {
      if (id != tabRecordedID) {
        setContentState((prevContentState) => ({
          ...prevContentState,
          recording: false,
        }));
      }
    }
  };

  const updateFromStorage = (check = true, id = null) => {
    chrome.storage.local.get(
      [
        "audioInput",
        "videoInput",
        "defaultAudioInput",
        "defaultVideoInput",
        "cameraDimensions",
        "cameraFlipped",
        "cameraActive",
        "micActive",
        "recording",
        "backgroundEffect",
        "backgroundEffectsActive",
        "toolbarPosition",
        "countdown",
        "recordingType",
        "customRegion",
        "regionWidth",
        "regionHeight",
        "regionX",
        "regionY",
        "hideToolbar",
        "alarm",
        "alarmTime",
        "pendingRecording",
        "askForPermissions",
        "cursorMode",
        "pushToTalk",
        "askMicrophone",
        "offscreenRecording",
        "zoomEnabled",
        "setDevices",
        "popupPosition",
        "surface",
        "hideUIAlerts",
        "hideUI",
        "bigTab",
        "toolbarHover",
        "askDismiss",
        "swatch",
        "color",
        "strokeWidth",
        "quality",
        "systemAudio",
        "backup",
        "backupSetup",
        "qualityValue",
        "fpsValue",
      ],
      (result) => {
        setContentState((prevContentState) => ({
          ...prevContentState,
          audioInput:
            result.audioInput !== undefined && result.audioInput !== null
              ? result.audioInput
              : prevContentState.audioInput,
          videoInput:
            result.videoInput !== undefined && result.videoInput !== null
              ? result.videoInput
              : prevContentState.videoInput,
          defaultAudioInput:
            result.defaultAudioInput !== undefined &&
            result.defaultAudioInput !== null
              ? result.defaultAudioInput
              : prevContentState.defaultAudioInput,
          defaultVideoInput:
            result.defaultVideoInput !== undefined &&
            result.defaultVideoInput !== null
              ? result.defaultVideoInput
              : prevContentState.defaultVideoInput,
          cameraDimensions:
            result.cameraDimensions !== undefined &&
            result.cameraDimensions !== null
              ? result.cameraDimensions
              : prevContentState.cameraDimensions,
          cameraFlipped:
            result.cameraFlipped !== undefined && result.cameraFlipped !== null
              ? result.cameraFlipped
              : prevContentState.cameraFlipped,
          cameraActive:
            result.cameraActive !== undefined && result.cameraActive !== null
              ? result.cameraActive
              : prevContentState.cameraActive,
          micActive:
            result.micActive !== undefined && result.micActive !== null
              ? result.micActive
              : prevContentState.micActive,
          backgroundEffect:
            result.backgroundEffect !== undefined &&
            result.backgroundEffect !== null
              ? result.backgroundEffect
              : prevContentState.backgroundEffect,
          backgroundEffectsActive:
            result.backgroundEffectsActive !== undefined &&
            result.backgroundEffectsActive !== null
              ? result.backgroundEffectsActive
              : prevContentState.backgroundEffectsActive,
          toolbarPosition:
            result.toolbarPosition !== undefined &&
            result.toolbarPosition !== null
              ? result.toolbarPosition
              : prevContentState.toolbarPosition,
          countdown:
            result.countdown !== undefined && result.countdown !== null
              ? result.countdown
              : prevContentState.countdown,
          recording:
            result.recording !== undefined && result.recording !== null
              ? result.recording
              : prevContentState.recording,
          recordingType:
            result.recordingType !== undefined && result.recordingType !== null
              ? result.recordingType
              : prevContentState.recordingType,
          customRegion:
            result.customRegion !== undefined && result.customRegion !== null
              ? result.customRegion
              : prevContentState.customRegion,
          regionWidth:
            result.regionWidth !== undefined && result.regionWidth !== null
              ? result.regionWidth
              : prevContentState.regionWidth,
          regionHeight:
            result.regionHeight !== undefined && result.regionHeight !== null
              ? result.regionHeight
              : prevContentState.regionHeight,
          regionX:
            result.regionX !== undefined && result.regionX !== null
              ? result.regionX
              : prevContentState.regionX,
          regionY:
            result.regionY !== undefined && result.regionY !== null
              ? result.regionY
              : prevContentState.regionY,
          hideToolbar:
            result.hideToolbar !== undefined && result.hideToolbar !== null
              ? result.hideToolbar
              : prevContentState.hideToolbar,
          alarm:
            result.alarm !== undefined && result.alarm !== null
              ? result.alarm
              : prevContentState.alarm,
          alarmTime:
            result.alarmTime !== undefined && result.alarmTime !== null
              ? result.alarmTime
              : prevContentState.alarmTime,
          pendingRecording:
            result.pendingRecording !== undefined &&
            result.pendingRecording !== null
              ? result.pendingRecording
              : prevContentState.pendingRecording,
          askForPermissions:
            result.askForPermissions !== undefined &&
            result.askForPermissions !== null
              ? result.askForPermissions
              : prevContentState.askForPermissions,
          cursorMode:
            result.cursorMode !== undefined && result.cursorMode !== null
              ? result.cursorMode
              : prevContentState.cursorMode,
          pushToTalk:
            result.pushToTalk !== undefined && result.pushToTalk !== null
              ? result.pushToTalk
              : prevContentState.pushToTalk,
          zoomEnabled:
            result.zoomEnabled !== undefined && result.zoomEnabled !== null
              ? result.zoomEnabled
              : prevContentState.zoomEnabled,
          askMicrophone:
            result.askMicrophone !== undefined && result.askMicrophone !== null
              ? result.askMicrophone
              : prevContentState.askMicrophone,
          offscreenRecording:
            result.offscreenRecording !== undefined &&
            result.offscreenRecording !== null
              ? result.offscreenRecording
              : prevContentState.offscreenRecording,
          setDevices:
            result.setDevices !== undefined && result.setDevices !== null
              ? result.setDevices
              : prevContentState.setDevices,
          popupPosition:
            result.popupPosition !== undefined && result.popupPosition !== null
              ? result.popupPosition
              : prevContentState.popupPosition,
          surface:
            result.surface !== undefined && result.surface !== null
              ? result.surface
              : prevContentState.surface,
          hideUIAlerts:
            result.hideUIAlerts !== undefined && result.hideUIAlerts !== null
              ? result.hideUIAlerts
              : prevContentState.hideUIAlerts,
          hideUI:
            result.hideUI !== undefined && result.hideUI !== null
              ? result.hideUI
              : prevContentState.hideUI,
          bigTab:
            result.bigTab !== undefined && result.bigTab !== null
              ? result.bigTab
              : prevContentState.bigTab,
          toolbarHover:
            result.toolbarHover !== undefined && result.toolbarHover !== null
              ? result.toolbarHover
              : prevContentState.toolbarHover,
          askDismiss:
            result.askDismiss !== undefined && result.askDismiss !== null
              ? result.askDismiss
              : prevContentState.askDismiss,
          swatch:
            result.swatch !== undefined && result.swatch !== null
              ? result.swatch
              : prevContentState.swatch,
          color:
            result.color !== undefined && result.color !== null
              ? result.color
              : prevContentState.color,
          strokeWidth:
            result.strokeWidth !== undefined && result.strokeWidth !== null
              ? result.strokeWidth
              : prevContentState.strokeWidth,
          quality:
            result.quality !== undefined && result.quality !== null
              ? result.quality
              : prevContentState.quality,
          systemAudio:
            result.systemAudio !== undefined && result.systemAudio !== null
              ? result.systemAudio
              : prevContentState.systemAudio,
          backup:
            result.backup !== undefined && result.backup !== null
              ? result.backup
              : prevContentState.backup,
          backupSetup:
            result.backupSetup !== undefined && result.backupSetup !== null
              ? result.backupSetup
              : prevContentState.backupSetup,
          qualityValue:
            result.qualityValue !== undefined && result.qualityValue !== null
              ? result.qualityValue
              : prevContentState.qualityValue,
          fpsValue:
            result.fpsValue !== undefined && result.fpsValue !== null
              ? result.fpsValue
              : prevContentState.fpsValue,
        }));

        if (result.systemAudio === undefined || result.systemAudio === null) {
          chrome.storage.local.set({ systemAudio: true });
        }

        if (
          result.backgroundEffect === undefined ||
          result.backgroundEffect === null
        ) {
          chrome.storage.local.set({ backgroundEffect: "blur" });
        }

        if (result.backup === undefined || result.backup === null) {
          chrome.storage.local.set({ backup: false });
        }

        if (result.countdown === undefined || result.countdown === null) {
          chrome.storage.local.set({ countdown: true });
        }

        if (result.backupSetup === undefined || result.backupSetup === null) {
          chrome.storage.local.set({ backupSetup: false });
        }

        if (result.backgroundEffectsActive) {
          chrome.runtime.sendMessage({ type: "backgroundEffectsActive" });
        }

        if (check) {
          checkRecording(id);
        }

        if (result.alarm) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            time: parseFloat(result.alarmTime),
            timer: parseFloat(result.alarmTime),
          }));
        } else if (!result.recording) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            time: 0,
            timer: 0,
          }));
        }

        chrome.storage.local.set({ restarting: false });
      }
    );
  };

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
