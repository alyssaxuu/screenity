import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";

import * as ToastEl from "@radix-ui/react-toast";

// Context
import { contentStateContext } from "../../context/ContentState";

const Toast = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState(() => {});
  const triggerRef = useRef(trigger);
  const openRef = useRef(open);
  const contentStateRef = useRef(contentState);
  const [toastDuration, setToastDuration] = useState(2000);

  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);

  const openToast = useCallback((title, action, durationMs = 2000) => {
    if (contentStateRef.current.hideUI) return;
    setTitle(title);
    setOpen(true);
    setTrigger(() => action);
    setToastDuration(durationMs);
  });

  useEffect(() => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      openToast: openToast,
    }));

    return () => {
      setContentState((prevContentState) => ({
        ...prevContentState,
        openToast: null,
      }));
    };
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    triggerRef.current = trigger;

    return () => {
      triggerRef.current = () => {};
    };
  }, [trigger]);

  return (
    <ToastEl.Provider swipeDirection="down" duration={toastDuration}>
      <ToastEl.Root
        className="ToastRoot"
        open={open}
        onOpenChange={setOpen}
        onEscapeKeyDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          triggerRef.current();
          setOpen(false);
        }}
      >
        <ToastEl.Title className="ToastTitle">{title}</ToastEl.Title>
        <ToastEl.Action
          className="ToastAction"
          asChild
          altText="Escape"
          onClick={() => {
            trigger();
          }}
        >
          <button
            className="Button"
            onClick={(e) => {
              e.stopPropagation();
              trigger();
            }}
          >
            Esc
          </button>
        </ToastEl.Action>
      </ToastEl.Root>
      <ToastEl.Viewport className="ToastViewport" />
    </ToastEl.Provider>
  );
};

export default Toast;
