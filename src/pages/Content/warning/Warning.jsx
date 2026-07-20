import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";

import {
  AudioIcon,
  CameraCloseIcon,
  NotSupportedIcon,
  CameraIcon,
  VideoOffIcon,
} from "../toolbar/components/SVG";

import * as ToastEl from "@radix-ui/react-toast";

// Context
import { contentStateContext } from "../context/ContentState";

const Warning = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Record computer audio");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("AudioIcon");
  const [duration, setDuration] = useState(10000);
  const [position, setPosition] = useState("top");

  const openWarning = useCallback(
    (title, description, icon, duration, position = "top") => {
      setTitle(title);
      setDescription(description);
      setIcon(icon);
      setDuration(duration);
      setPosition(position);
      setOpen(true);
    },
    [],
  );

  useEffect(() => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      openWarning: openWarning,
    }));

    return () => {
      setContentState((prevContentState) => ({
        ...prevContentState,
        openWarning: null,
      }));
    };
  }, []);

  useEffect(() => {
    if (icon === "AudioIcon") {
      if (contentState.recordingType === "region") {
        setOpen(false);
      }
    }
  }, [contentState.recordingType]);

  // Close once the stream exists rather than waiting for recording to flip: the
  // capture is already live through the countdown, so a toast still on screen at
  // 3-2-1 lands in the opening frames.
  useEffect(() => {
    if (contentState.countdownActive) {
      setOpen(false);
    }
  }, [contentState.countdownActive]);

  // With the countdown off, recording is the earliest signal available.
  useEffect(() => {
    if (contentState.recording) {
      setOpen(false);
    }
  }, [contentState.recording]);

  // Flow ended without recording (picker cancelled, stream error). Scoped to the
  // audio guidance so a warning explaining the failure isn't yanked away.
  useEffect(() => {
    if (!contentState.pendingRecording && icon === "AudioIcon") {
      setOpen(false);
    }
  }, [contentState.pendingRecording]);

  return (
    <ToastEl.Provider
      swipeDirection={position === "bottom" ? "down" : "up"}
      duration={duration}
    >
      <ToastEl.Root
        className="warning-root"
        open={open}
        onOpenChange={setOpen}
        onSwipeEnd={() => {
          setOpen(false);
        }}
      >
        <div className="warning-icon">
          {icon === "AudioIcon" && <AudioIcon />}
          {icon === "NotSupportedIcon" && <NotSupportedIcon />}
          {icon === "CameraIcon" && <CameraIcon />}
          {icon === "VideoOffIcon" && <VideoOffIcon />}
        </div>
        <div className="warning-content">
          <ToastEl.Title className="warning-title">{title}</ToastEl.Title>
          <ToastEl.Description className="warning-description">
            {description}
          </ToastEl.Description>
        </div>
        <ToastEl.Close
          className="warning-close"
          onClick={() => {
            setOpen(false);
          }}
        >
          <CameraCloseIcon />
        </ToastEl.Close>
      </ToastEl.Root>
      <ToastEl.Viewport
        className={
          position === "bottom"
            ? "WarningViewport WarningViewport--bottom"
            : "WarningViewport"
        }
      />
    </ToastEl.Provider>
  );
};

export default Warning;
