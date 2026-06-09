import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";

import * as ToastEl from "@radix-ui/react-toast";

import { ContentStateContext } from "../../context/ContentState";

const Toast = () => {
  const [contentState, setContentState] = useContext(ContentStateContext);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(2200);
  const actionRef = useRef(null);

  const openToast = useCallback((nextTitle, action = null, durationMs = 2200) => {
    setTitle(nextTitle);
    setDuration(durationMs);
    actionRef.current = typeof action === "function" ? action : null;
    setOpen(false);
    requestAnimationFrame(() => setOpen(true));
  }, []);

  useEffect(() => {
    setContentState((prev) => ({ ...prev, openToast }));
    return () => {
      setContentState((prev) => ({ ...prev, openToast: null }));
    };
  }, []);

  const fireAction = () => {
    const fn = actionRef.current;
    actionRef.current = null;
    setOpen(false);
    if (fn) {
      try {
        fn();
      } catch {}
    }
  };

  return (
    <ToastEl.Provider swipeDirection="down" duration={duration}>
      <ToastEl.Root
        className="ToastRoot"
        open={open}
        onOpenChange={setOpen}
        onEscapeKeyDown={(e) => {
          if (!actionRef.current) return;
          e.preventDefault();
          fireAction();
        }}
      >
        <ToastEl.Title className="ToastTitle">{title}</ToastEl.Title>
        {actionRef.current && (
          <ToastEl.Action className="ToastAction" asChild altText="Esc">
            <button
              className="ToastEscButton"
              onClick={(e) => {
                e.stopPropagation();
                fireAction();
              }}
            >
              Esc
            </button>
          </ToastEl.Action>
        )}
      </ToastEl.Root>
      <ToastEl.Viewport className="ToastViewport" />
    </ToastEl.Provider>
  );
};

export default Toast;
