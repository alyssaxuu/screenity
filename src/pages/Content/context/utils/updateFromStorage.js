import { setContentState } from "../ContentState";
import { checkRecording } from "./checkRecording";

export const updateFromStorage = (check = true, id = null) => {
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
      "paused",
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
      "countdownActive",
      "countdownCancelled",
      "isCountdownVisible",
      "multiMode",
      "multiSceneCount",
      "sortBy",
      "wasLoggedIn",
      "instantMode",
      "hasSeenInstantModeModal",
      "hasSubscribedBefore",
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
        paused:
          result.paused !== undefined && result.paused !== null
            ? result.paused
            : prevContentState.paused,
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
        countdownActive: result.countdownActive || false,
        countdownCancelled: result.countdownCancelled || false,
        isCountdownVisible: result.isCountdownVisible || false,
        multiMode: result.multiMode || false,
        multiSceneCount: result.multiSceneCount || 0,
        wasLoggedIn: result.wasLoggedIn || false,
        sortBy: result.sortBy || "newest",
        instantMode: result.instantMode || false,
        hasSeenInstantModeModal: result.hasSeenInstantModeModal || false,
        onboarding: result.onboarding || false,
        hasSubscribedBefore: result.hasSubscribedBefore || false,
        showProSplash: result.showProSplash || false,
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
