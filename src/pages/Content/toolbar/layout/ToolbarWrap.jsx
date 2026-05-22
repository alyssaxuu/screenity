import React, {
  useLayoutEffect,
  useEffect,
  useContext,
  useState,
  useRef,
} from "react";
import * as Toolbar from "@radix-ui/react-toolbar";

import { Rnd } from "react-rnd";

// Drawing toolbar; was previously React.lazy'd to keep fabric out of
// the content-script hot bundle, but lazy chunks can't be loaded from
// a content script on strict-CSP pages (host's script-src blocks
// chrome-extension:// <script> injection even with
// web_accessible_resources). Static import is the only working option.
import DrawingToolbar from "./DrawingToolbar";
import CursorToolbar from "./CursorToolbar";
import BlurToolbar from "./BlurToolbar";

import ToolTrigger from "../components/ToolTrigger";
import Toast from "../components/Toast";

import { CloseIconPopup } from "../components/SVG";

import { contentStateContext } from "../../context/ContentState";

import {
  GrabIcon,
  StopIcon,
  DrawIcon,
  PauseIcon,
  ResumeIcon,
  CursorIcon,
  TargetCursorIcon,
  HighlightCursorIcon,
  SpotlightCursorIcon,
  RestartIcon,
  DiscardIcon,
  CameraIcon,
  BlurIcon,
  OnboardingArrow,
  CloseButtonToolbar,
} from "../components/SVG";
import MicToggle from "../components/MicToggle";

const ToolbarWrap = () => {
  const [contentState, setContentState, t, setT] =
    useContext(contentStateContext);
  const [mode, setMode] = React.useState("");
  const modeRef = React.useRef(mode);
  const [hovering, setHovering] = React.useState(false);
  const DragRef = React.useRef(null);
  const ToolbarRef = React.useRef(null);
  const [side, setSide] = React.useState("ToolbarTop");
  const [elastic, setElastic] = React.useState("");
  const [shake, setShake] = React.useState("");
  const [dragging, setDragging] = React.useState("");
  const [timer, setTimer] = React.useState(0);
  const [timestamp, setTimestamp] = React.useState("00:00");
  const [transparent, setTransparent] = React.useState(false);
  const [forceTransparent, setForceTransparent] = React.useState("");
  const [visuallyHidden, setVisuallyHidden] = useState(false);
  const timeRef = React.useRef("");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    setContentState((prev) => ({
      ...prev,
      setToolbarMode: setMode,
      toolbarMode: mode,
    }));
  }, [mode, setContentState]);

  useEffect(() => {
    if (contentState.toolbarHover && contentState.hideUI) {
      setTransparent("ToolbarTransparent");
    } else {
      setTransparent(false);
      setForceTransparent("");
    }
  }, [contentState.toolbarHover, contentState.hideUI]);

  useEffect(() => {
    if (!contentState.toolbarHover) return;
    if (!contentState.shadowRef) return;
    if (!contentState.hideUI) return;
    const handleMouseDown = (e) => {
      if (contentState.toolbarHover && contentState.hideUI) {
        if (ToolbarRef.current && ToolbarRef.current.contains(e.target)) return;
        if (
          contentState.shadowRef &&
          (contentState.shadowRef.contains(e.target) ||
            contentState.shadowRef === e.target ||
            contentState.shadowRef === e.target.parentNode)
        )
          return;

        setForceTransparent("ForceTransparent");
      }
    };

    const handleMouseUp = (e) => {
      setForceTransparent("");
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [contentState.toolbarHover, contentState.shadowRef, contentState.hideUI]);

  useEffect(() => {
    if (!isNaN(t)) {
      setTimer(t);
      const clampedT = Math.max(0, t);
      const hours = Math.floor(clampedT / 3600);
      const minutes = Math.floor((clampedT % 3600) / 60);
      const seconds = clampedT % 60;

      let newTimestamp =
        hours > 0
          ? `${hours.toString().padStart(2, "0")}:${minutes
              .toString()
              .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
          : `${minutes.toString().padStart(2, "0")}:${seconds
              .toString()
              .padStart(2, "0")}`;

      if (hours > 0) {
        timeRef.current.style.width = "58px";
      } else {
        timeRef.current.style.width = "42px";
      }

      setTimestamp(newTimestamp);
    }
  }, [t]);

  useLayoutEffect(() => {
    function setToolbarPosition(e) {
      let xpos = DragRef.current.getDraggablePosition().x;
      let ypos = DragRef.current.getDraggablePosition().y;

      const rect = ToolbarRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Keep toolbar proportional to bottom-right.
      if (xpos + width + 30 > window.innerWidth) {
        xpos = window.innerWidth - width - 30;
      }
      if (ypos + height - 60 > window.innerHeight) {
        ypos = window.innerHeight - height + 60;
      }

      DragRef.current.updatePosition({ x: xpos, y: ypos });
    }
    window.addEventListener("resize", setToolbarPosition);
    setToolbarPosition();
    return () => window.removeEventListener("resize", setToolbarPosition);
  }, []);

  const handleChange = (value) => {
    setMode(value);
  };

  const handleDragStart = (e, d) => {
    setDragging("ToolbarDragging");
  };

  const handleDrag = (e, d) => {
    // Drag fires ~60Hz; cache rect.
    const rect = ToolbarRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (d.y < 130) {
      setSide("ToolbarBottom");
    } else {
      setSide("ToolbarTop");
    }

    if (
      d.x < -25 ||
      d.x + width > window.innerWidth ||
      d.y < 60 ||
      d.y + height - 80 > window.innerHeight
    ) {
      setShake("ToolbarShake");
    } else {
      setShake("");
    }
  };

  const handleDrop = (e, d) => {
    setShake("");
    setDragging("");
    let xpos = d.x;
    let ypos = d.y;

    const rect = ToolbarRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (d.x < -10) {
      setElastic("ToolbarElastic");
      xpos = -10;
    } else if (d.x + width + 30 > window.innerWidth) {
      setElastic("ToolbarElastic");
      xpos = window.innerWidth - width - 30;
    }

    if (d.y < 130) {
      setSide("ToolbarBottom");
    } else {
      setSide("ToolbarTop");
    }

    if (d.y < 80) {
      setElastic("ToolbarElastic");
      ypos = 80;
    } else if (d.y + height - 60 > window.innerHeight) {
      setElastic("ToolbarElastic");
      ypos = window.innerHeight - height + 60;
    }
    DragRef.current.updatePosition({ x: xpos, y: ypos });

    setTimeout(() => {
      setElastic("");
    }, 250);

    setContentState((prevContentState) => ({
      ...prevContentState,
      toolbarPosition: {
        ...prevContentState.toolbarPosition,
        offsetX: xpos,
        offsetY: ypos,
        left: xpos < window.innerWidth / 2 ? true : false,
        right: xpos < window.innerWidth / 2 ? false : true,
        top: ypos < window.innerHeight / 2 ? true : false,
        bottom: ypos < window.innerHeight / 2 ? false : true,
      },
    }));

    let left = xpos < window.innerWidth / 2 ? true : false;
    let right = xpos < window.innerWidth / 2 ? false : true;
    let top = ypos < window.innerHeight / 2 ? true : false;
    let bottom = ypos < window.innerHeight / 2 ? false : true;
    let offsetX = xpos;
    let offsetY = ypos;

    if (right) {
      offsetX = window.innerWidth - xpos;
    }
    if (bottom) {
      offsetY = window.innerHeight - ypos;
    }

    setContentState((prevContentState) => ({
      ...prevContentState,
      toolbarPosition: {
        ...prevContentState.toolbarPosition,
        offsetX: offsetX,
        offsetY: offsetY,
        left: left,
        right: right,
        top: top,
        bottom: bottom,
      },
    }));

    chrome.storage.local.set({
      toolbarPosition: {
        offsetX: offsetX,
        offsetY: offsetY,
        left: left,
        right: right,
        top: top,
        bottom: bottom,
      },
    });
  };

  useEffect(() => {
    let x = contentState.toolbarPosition.offsetX;
    let y = contentState.toolbarPosition.offsetY;

    if (contentState.toolbarPosition.bottom) {
      y = window.innerHeight - contentState.toolbarPosition.offsetY;
    }

    if (contentState.toolbarPosition.right) {
      x = window.innerWidth - contentState.toolbarPosition.offsetX;
    }

    // Clamp into viewport: saved positions from a larger display can land
    // off-screen (external monitor saved, restored on built-in).
    const rect = ToolbarRef.current?.getBoundingClientRect();
    const tbWidth = rect?.width || 0;
    const tbHeight = rect?.height || 0;
    if (x + tbWidth > window.innerWidth) x = window.innerWidth - tbWidth;
    if (y + tbHeight > window.innerHeight) y = window.innerHeight - tbHeight;
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    DragRef.current.updatePosition({ x: x, y: y });

    handleDrop(null, { x: x, y: y });
  }, []);

  useEffect(() => {
    if (!contentState.openToast) return;
    if (contentState.drawingMode) {
      contentState.openToast(chrome.i18n.getMessage("drawingModeToast"), () => {
        setMode("");
      });
    }
    if (contentState.blurMode) {
      contentState.openToast(chrome.i18n.getMessage("blurModeToast"), () => {
        setMode("");
      });
    }
  }, [contentState.drawingMode, contentState.blurMode, contentState.openToast]);

  useEffect(() => {
    if (contentState.drawingMode) setMode("draw");
    else if (contentState.blurMode) setMode("blur");
    else setMode("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "draw") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        drawingMode: true,
        showOnboardingArrow: false,
      }));
    } else {
      setContentState((prevContentState) => ({
        ...prevContentState,
        drawingMode: false,
      }));
    }
    if (mode === "blur") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        blurMode: true,
        drawingMode: false,
      }));
    } else {
      setContentState((prevContentState) => ({
        ...prevContentState,
        blurMode: false,
      }));
    }
  }, [mode]);

  const enableCamera = () => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      cameraActive: true,
    }));
    chrome.storage.local.set({
      cameraActive: true,
    });
    setContentState((prevContentState) => ({
      ...prevContentState,
      pipEnded: true,
    }));
  };

  return (
    <div>
      <Toast />
      <div
        className={
          contentState.paused && contentState.recording
            ? "ToolbarPaused"
            : "ToolbarPaused hidden"
        }
      ></div>
      <div className={"ToolbarBounds" + " " + shake}></div>
      <Rnd
        default={{
          x: 200,
          y: 500,
        }}
        className={
          "react-draggable" + " " + elastic + " " + shake + " " + dragging
        }
        dragHandleClassName="grab"
        enableResizing={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDrop}
        ref={DragRef}
        id="pro-onboarding-recording-toolbar"
      >
        <Toolbar.Root
          id="pro-onboarding-recording-toolbar-root"
          className={
            "ToolbarRoot" +
            " " +
            side +
            " " +
            transparent +
            " " +
            forceTransparent +
            (visuallyHidden ? " visually-hidden-toolbar" : "")
          }
          ref={ToolbarRef}
          onMouseOver={() => {
            setHovering(true);
          }}
          onMouseLeave={() => {
            setHovering(false);
          }}
        >
          <ToolTrigger grab type="button" content="">
            <GrabIcon />
          </ToolTrigger>
          {!contentState.recording && (
            <div
              className={`popup-controls toolbar-controls ${
                hovering ? "open" : ""
              }`}
              onClick={() => {
                if (contentState.openToast) {
                  contentState.openToast(
                    chrome.i18n.getMessage("reopenToolbarToast"),
                    () => {},
                  );
                }

                setVisuallyHidden(true);

                setContentState((prev) => ({
                  ...prev,

                  drawingMode: false,
                  blurMode: false,
                }));
                // Wait for toast (~3s) before real hide.
                setTimeout(() => {
                  setContentState((prev) => ({
                    ...prev,
                    hideToolbar: true,
                    drawingMode: false,
                    blurMode: false,
                    hideUIAlerts: false,
                    toolbarHover: false,
                    hideUI: true,
                  }));

                  chrome.storage.local.set({
                    hideToolbar: true,
                    hideUIAlerts: false,
                    toolbarHover: false,
                    hideUI: true,
                  });
                }, 3000);
              }}
            >
              <div className="popup-control popup-close">
                <CloseIconPopup />
              </div>
            </div>
          )}
          <div
            className={"ToolbarRecordingControls"}
            id="pro-onboarding-recording-toolbar-controls"
          >
            <ToolTrigger
              type="button"
              content={chrome.i18n.getMessage("finishRecordingTooltip")}
              disabled={!contentState.recording || contentState.finalizingRecording}
              onClick={() => {
                contentState.stopRecording();
              }}
            >
              <StopIcon width="20" height="20" />
            </ToolTrigger>
            <div
              className={`ToolbarRecordingTime ${
                contentState.timeWarning ? "TimerWarning" : ""
              }`}
              ref={timeRef}
            >
              {timestamp}
            </div>
            <ToolTrigger
              type="button"
              content={chrome.i18n.getMessage("restartRecordingTooltip")}
              disabled={!contentState.recording || contentState.finalizingRecording}
              onClick={() => {
                contentState.tryRestartRecording();
              }}
            >
              <RestartIcon />
            </ToolTrigger>
            {!contentState.paused && (
              <ToolTrigger
                type="button"
                content={chrome.i18n.getMessage("pauseRecordingTooltip")}
                disabled={!contentState.recording || contentState.finalizingRecording}
                onClick={() => {
                  contentState.pauseRecording();
                }}
              >
                <PauseIcon />
              </ToolTrigger>
            )}
            {contentState.recording && contentState.paused && (
              <ToolTrigger
                type="button"
                resume
                content={chrome.i18n.getMessage("resumeRecordingTooltip")}
                disabled={!contentState.recording || contentState.finalizingRecording}
                onClick={() => {
                  contentState.resumeRecording();
                }}
              >
                <ResumeIcon />
              </ToolTrigger>
            )}
            <ToolTrigger
              type="button"
              content={chrome.i18n.getMessage("cancelRecordingTooltip")}
              disabled={!contentState.recording || contentState.finalizingRecording}
              onClick={() => {
                if (contentState.tryDismissRecording !== undefined) {
                  contentState.tryDismissRecording();
                }
              }}
            >
              <DiscardIcon />
            </ToolTrigger>
          </div>
          <Toolbar.Separator className="ToolbarSeparator" />
          <Toolbar.ToggleGroup
            type="single"
            className="ToolbarToggleGroup"
            value={mode}
            onValueChange={handleChange}
          >
            <div className="ToolbarToggleWrap">
              {contentState.showOnboardingArrow && (
                <div className="OnboardingArrow">
                  <div className="OnboardingText">
                    {chrome.i18n.getMessage("clickHereDrawOnboarding")}
                  </div>
                  <div className="ArrowShape">
                    <OnboardingArrow />
                  </div>
                </div>
              )}
              <ToolTrigger
                type="mode"
                content={chrome.i18n.getMessage("toggleDrawingToolsTooltip")}
                value="draw"
                shortcut={contentState.toggleDrawingModeShortcut}
                disabled={contentState.recordingType === "camera"}
              >
                {mode === "draw" && <CloseButtonToolbar />}
                {mode !== "draw" && <DrawIcon />}
              </ToolTrigger>
              <DrawingToolbar visible={mode === "draw" ? "show-toolbar" : ""} />
            </div>
            <div className="ToolbarToggleWrap">
              <ToolTrigger
                type="mode"
                content={chrome.i18n.getMessage("toggleBlurToolTooltip")}
                value="blur"
                shortcut={contentState.toggleBlurModeShortcut}
                disabled={contentState.recordingType === "camera"}
              >
                {mode === "blur" && <CloseButtonToolbar />}
                {mode !== "blur" && <BlurIcon />}
              </ToolTrigger>
              <BlurToolbar visible={mode === "blur" ? "show-toolbar" : ""} />
            </div>

            <div className="ToolbarToggleWrap">
              <ToolTrigger
                type="mode"
                content={chrome.i18n.getMessage("toggleCursorOptionsTooltip")}
                value="cursor"
                shortcut={contentState.toggleCursorModeShortcut}
                disabled={contentState.recordingType === "camera"}
              >
                {contentState.cursorMode === "target" && <TargetCursorIcon />}
                {contentState.cursorMode === "highlight" && (
                  <HighlightCursorIcon />
                )}
                {contentState.cursorMode === "spotlight" && (
                  <SpotlightCursorIcon />
                )}
                {contentState.cursorMode === "none" && <CursorIcon />}
              </ToolTrigger>
              <CursorToolbar
                visible={mode === "cursor" ? "show-toolbar" : ""}
                mode={mode}
                setMode={setMode}
              />
            </div>
            <Toolbar.Separator className="ToolbarSeparator" />
            <MicToggle />
            {(!contentState.cameraActive ||
              contentState.defaultVideoInput === "none") &&
              (!contentState.isSubscribed || !contentState.recording) &&
              contentState.recordingType != "camera-only" && (
                <ToolTrigger
                  type="button"
                  content={
                    contentState.cameraActive && contentState.cameraPermission
                      ? chrome.i18n.getMessage("disableCameraTooltip")
                      : !contentState.cameraActive &&
                        contentState.cameraPermission
                      ? chrome.i18n.getMessage("enableCameraTooltip")
                      : chrome.i18n.getMessage("noCameraPermissionsTooltip")
                  }
                  value="camera"
                  onClick={enableCamera}
                  disabled={
                    !contentState.cameraPermission ||
                    contentState.defaultVideoInput === "none"
                  }
                >
                  <CameraIcon />
                </ToolTrigger>
              )}
          </Toolbar.ToggleGroup>
        </Toolbar.Root>
      </Rnd>
    </div>
  );
};

export default ToolbarWrap;
