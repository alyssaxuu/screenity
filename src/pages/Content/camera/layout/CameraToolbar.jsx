import React, { useState, useEffect, useContext } from "react";

import * as Toolbar from "@radix-ui/react-toolbar";

import TooltipWrap from "../../toolbar/components/TooltipWrap";

import { CameraCloseIcon, Pip } from "../../toolbar/components/SVG";

import { contentStateContext } from "../../context/ContentState";
import {
  cameraCanLiveInWindow,
  prompterCaptureStatus,
} from "../../teleprompter/prompterRules";
import {
  closePipLayer,
  getPipLayers,
  isPrompterWindowSupported,
  openPipLayer,
  setCameraManual,
} from "../../teleprompter/prompterWindow";

const CameraToolbar = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const eligible = cameraCanLiveInWindow({
    cloud: process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true",
    subscribed: contentState.isSubscribed,
    instantMode: contentState.instantMode,
  });
  // Burnt-in camera: only a full-screen capture can move it to PiP, elsewhere it
  // would drop out of the video. Own track: any capture that leaves the window out.
  const captureOk =
    prompterCaptureStatus({
      recordingType: contentState.recordingType,
      surface: contentState.surface,
    }) === "ok";
  const fullScreenNow =
    Boolean(contentState.recording) &&
    contentState.recordingType === "screen" &&
    contentState.surface === "monitor";
  const docSupported = isPrompterWindowSupported();
  const showPip =
    contentState.recordingType === "camera"
      ? false
      : eligible
      ? (!contentState.recording || captureOk) && docSupported
      : docSupported && fullScreenNow;

  return (
    <Toolbar.Root className="camera-toolbar">
      <Toolbar.Button
        className="CameraToolbarButton"
        onClick={() => {
          setContentState((prevContentState) => ({
            ...prevContentState,
            cameraActive: false,
          }));
          chrome.storage.local.set({ cameraActive: false });
        }}
      >
        <CameraCloseIcon />
      </Toolbar.Button>
      {/* Manual toggle, deliberately not gated on surface or recordingType.
          Auto-PiP is decided in surfaceHandler; this is the way back into PiP
          after closing it, and `surface` is not reliably set on every flow. */}
      {showPip && (
        <TooltipWrap
          content={chrome.i18n.getMessage("togglePictureinPictureModeTooltip")}
        >
          <Toolbar.Button
            className="CameraToolbarButton CameraMore"
            onClick={() => {
              if (getPipLayers().camera) {
                closePipLayer("camera", "bubble button");
                return;
              }
              const allowed = eligible
                ? !contentState.recording || captureOk
                : fullScreenNow;
              if (docSupported && allowed && !contentState.pipActive) {
                setCameraManual(true);
                // A burnt-in camera can't sit beside the script.
                if (!eligible) closePipLayer("prompter", "camera takes over");
                openPipLayer("camera", "bubble button").then((opened) => {
                  if (!opened) setCameraManual(false);
                });
              }
            }}
          >
            <Pip />
          </Toolbar.Button>
        </TooltipWrap>
      )}
    </Toolbar.Root>
  );
};

export default CameraToolbar;
