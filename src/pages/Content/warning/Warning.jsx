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

  const openWarning = useCallback((title, description, icon, duration) => {
    setTitle(title);
    setDescription(description);
    setIcon(icon);
    setDuration(duration);
    setOpen(true);
  }, []);

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

  useEffect(() => {
    if (contentState.recording) {
      setOpen(false);
    }
  }, [contentState.recording]);

  return (
    <ToastEl.Provider swipeDirection="up" duration={duration}>
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
      <ToastEl.Viewport className="WarningViewport" />
    </ToastEl.Provider>
  );
};

export default Warning;
