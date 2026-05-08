import React, { useEffect, useContext, useRef, useState } from "react";

import * as Tooltip from "@radix-ui/react-tooltip";

import { contentStateContext } from "../../context/ContentState";

const HOVER_DELAY = 700;

const TooltipWrap = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const classname = props.name ? props.name : "";
  const [override, setOverride] = useState("");
  const [open, setOpen] = useState(false);
  const openTimerRef = useRef(null);
  const content =
    props.shortcut && props.content
      ? `${props.content} (${props.shortcut})`
      : props.content;

  useEffect(() => {
    if (contentState.hideUI) {
      setOverride("override");
    } else {
      setOverride("");
    }
  }, [contentState.hideUI]);

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, []);

  const cancelOpenTimer = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };

  const handlePointerEnter = () => {
    cancelOpenTimer();
    openTimerRef.current = setTimeout(() => setOpen(true), HOVER_DELAY);
  };

  const handlePointerLeave = () => {
    cancelOpenTimer();
    setOpen(false);
  };

  return (
    <div className={classname} style={props.style}>
      {props.content == "" ? (
        <div>{props.children}</div>
      ) : (
        <Tooltip.Provider>
          <Tooltip.Root open={open && override !== "override"}>
            <Tooltip.Trigger
              asChild
              onPointerEnter={handlePointerEnter}
              onPointerLeave={handlePointerLeave}
            >
              {props.children}
            </Tooltip.Trigger>
            <Tooltip.Portal
              container={
                document.getElementsByClassName("screenity-shadow-dom")[0]
              }
            >
              <Tooltip.Content
                onPointerEnter={cancelOpenTimer}
                onPointerLeave={() => setOpen(false)}
                className={
                  "TooltipContent" +
                  " " +
                  props.override +
                  " " +
                  props.hide +
                  " " +
                  override
                }
              >
                {content}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
    </div>
  );
};

export default TooltipWrap;
