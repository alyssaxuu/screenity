import React, { useLayoutEffect, useEffect, useContext, useRef } from "react";
import * as Toolbar from "@radix-ui/react-toolbar";

import { Rnd } from "react-rnd";

// Layout
import DrawingToolbar from "./DrawingToolbar";
import CursorToolbar from "./CursorToolbar";
import BlurToolbar from "./BlurToolbar";

// Components
import ToolTrigger from "../components/ToolTrigger";
import Toast from "../components/Toast";

// Context
import { contentStateContext } from "../../context/ContentState";

// Icons
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
  const timeRef = React.useRef("");

  useEffect(() => {
    if (contentState.toolbarHover && contentState.hideUI) {
      setTransparent("ToolbarTransparent");
    } else {
      setTransparent(false);
      setForceTransparent("");
    }
  }, [contentState.toolbarHover, contentState.hideUI]);

  // If mouse is down and toolbarHover is true, set forceTransparent
  useEffect(() => {
    if (!contentState.toolbarHover) return;
    if (!contentState.shadowRef) return;
    if (!contentState.hideUI) return;
    const handleMouseDown = (e) => {
      if (contentState.toolbarHover && contentState.hideUI) {
        // check if mouse is over toolbar
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
      const hours = Math.floor(t / 3600);
      const minutes = Math.floor((t % 3600) / 60);
      const seconds = t % 60;

      // Determine the timestamp format based on the total duration (t)
      let newTimestamp =
        hours > 0
          ? `${hours.toString().padStart(2, "0")}:${minutes
              .toString()
              .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
          : `${minutes.toString().padStart(2, "0")}:${seconds
              .toString()
              .padStart(2, "0")}`;

      // Adjust the width of the time display based on the duration
      if (hours > 0) {
        // Adjust for HH:MM:SS format when hours are present
        timeRef.current.style.width = "58px"; // You might need to adjust this value based on your actual UI
      } else {
        // Adjust for MM:SS format when there are no hours
        timeRef.current.style.width = "42px"; // Adjust this value as needed
      }

      setTimestamp(newTimestamp);
    }
  }, [t]);

  useLayoutEffect(() => {
    function setToolbarPosition(e) {
      let xpos = DragRef.current.getDraggablePosition().x;
      let ypos = DragRef.current.getDraggablePosition().y;

      // Width and height of toolbar
      const width = ToolbarRef.current.getBoundingClientRect().width;
      const height = ToolbarRef.current.getBoundingClientRect().height;

      // Keep toolbar positioned relative to the bottom and right of the screen, proportionally
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
    // Width and height
    const width = ToolbarRef.current.getBoundingClientRect().width;
    const height = ToolbarRef.current.getBoundingClientRect().height;

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

    // Width and height
    const width = ToolbarRef.current.getBoundingClientRect().width;
    const height = ToolbarRef.current.getBoundingClientRect().height;

    // Check if toolbar is off screen
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

    // Is it on the left or right, also top or bottom

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
      >
        <Toolbar.Root
          className={
            "ToolbarRoot" +
            " " +
            side +
            " " +
            transparent +
            " " +
            forceTransparent
          }
          ref={ToolbarRef}
        >
          <ToolTrigger grab type="button" content="">
            <GrabIcon />
          </ToolTrigger>
          <div className={"ToolbarRecordingControls"}>
            <ToolTrigger
              type="button"
              content={chrome.i18n.getMessage("finishRecordingTooltip")}
              disabled={!contentState.recording}
              onClick={() => {
                contentState.stopRecording();
              }}
            >
              <StopIcon width="20" height="20" />
            </ToolTrigger>
            <div className="ToolbarRecordingTime" ref={timeRef}>
              {timestamp}
            </div>
            <ToolTrigger
              type="button"
              content={chrome.i18n.getMessage("restartRecordingTooltip")}
              disabled={!contentState.recording}
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
                disabled={!contentState.recording}
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
                disabled={!contentState.recording}
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
              disabled={!contentState.recording}
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
