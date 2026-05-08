import React, { useState, useEffect, useContext, useMemo, useRef } from "react";

import { contentStateContext } from "../context/ContentState";

const CursorModes = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const effectsRef = useRef(new Set());
  // Refs to avoid querySelector per mousemove.
  const cursorHighlightRef = useRef(null);
  const cursorClickTargetRef = useRef(null);
  const spotlightRef = useRef(null);

  useEffect(() => {
    const nextEffects = Array.isArray(contentState.cursorEffects)
      ? contentState.cursorEffects
      : [];
    effectsRef.current = new Set(nextEffects);
  }, [contentState.cursorEffects]);

  const mouseDownHandler = (e) => {
    if (effectsRef.current.has("target")) {
      const target = cursorClickTargetRef.current;
      if (!target) return;
      target.style.transform =
        "translate(-50%, -50%) scale(1)";
      target.style.opacity = "1";
    }
  };

  const mouseUpHandler = (e) => {
    if (effectsRef.current.has("target")) {
      const target = cursorClickTargetRef.current;
      if (!target) return;
      target.style.transform =
        "translate(-50%, -50%) scale(0)";
      target.style.opacity = "0";

      window.setTimeout(() => {
        const targetReset = cursorClickTargetRef.current;
        if (!targetReset) return;
        targetReset.style.transform =
          "translate(-50%, -50%) scale(1)";
      }, 350);
    }
  };

  const [lastMousePosition, setLastMousePosition] = useState({ x: 0, y: 0 });
  const lastMouseRef = useRef(lastMousePosition);

  useEffect(() => {
    lastMouseRef.current = lastMousePosition;
  }, [lastMousePosition]);

  const updateCursorPosition = () => {
    const scrollTop = window.scrollY;
    const scrollLeft = window.scrollX;
    const mouseX = lastMouseRef.current.x;
    const mouseY = lastMouseRef.current.y;

    if (effectsRef.current.has("target")) {
      const target = cursorClickTargetRef.current;
      if (target) {
        target.style.top = mouseY + scrollTop + "px";
        target.style.left = mouseX + scrollLeft + "px";
      }
    }

    if (effectsRef.current.has("highlight")) {
      const highlight = cursorHighlightRef.current;
      if (highlight) {
        highlight.style.top = mouseY + scrollTop + "px";
        highlight.style.left = mouseX + scrollLeft + "px";
      }
    }

    if (effectsRef.current.has("spotlight")) {
      const spotlight = spotlightRef.current;
      if (spotlight) {
        spotlight.style.top = mouseY + scrollTop + "px";
        spotlight.style.left = mouseX + scrollLeft + "px";
      }
    }
  };

  // Coalesce DOM writes + setState into one RAF; mousemove fires at >120Hz
  // on modern trackpads.
  const stateRafRef = useRef(null);
  const scheduleCursorUpdate = () => {
    if (stateRafRef.current !== null) return;
    stateRafRef.current = requestAnimationFrame(() => {
      stateRafRef.current = null;
      if (effectsRef.current.size > 0) {
        updateCursorPosition();
      }
      // Spotlight is the only effect reading lastMousePosition from render.
      if (effectsRef.current.has("spotlight")) {
        setLastMousePosition(lastMouseRef.current);
      }
    });
  };
  const mouseMoveHandler = (e) => {
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    scheduleCursorUpdate();
  };

  const scrollHandler = () => {
    scheduleCursorUpdate();
  };

  useEffect(() => {
    document.addEventListener("mousedown", mouseDownHandler);
    document.addEventListener("mousemove", mouseMoveHandler);
    document.addEventListener("mouseup", mouseUpHandler);
    document.addEventListener("scroll", scrollHandler);

    return () => {
      document.removeEventListener("mousedown", mouseDownHandler);
      document.removeEventListener("mousemove", mouseMoveHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
      document.removeEventListener("scroll", scrollHandler);
      if (stateRafRef.current !== null) {
        cancelAnimationFrame(stateRafRef.current);
        stateRafRef.current = null;
      }
    };
  }, []);

  // Derive once per render so JSX doesn't re-scan the array three times.
  // Memoized styles let React skip diffing on highlight/target while
  // spotlight (depends on lastMousePosition) re-styles freely.
  const effects = contentState.cursorEffects;
  const showHighlight = Array.isArray(effects) && effects.includes("highlight");
  const showTarget = Array.isArray(effects) && effects.includes("target");
  const showSpotlight = Array.isArray(effects) && effects.includes("spotlight");

  const highlightStyle = useMemo(
    () => ({
      display: "block",
      visibility: showHighlight ? "visible" : "hidden",
      position: "absolute",
      top: 0,
      left: 0,
      width: "80px",
      height: "80px",
      pointerEvents: "none",
      zIndex: 99999999999,
      background: "yellow",
      opacity: ".5",
      transform: "translate(-50%, -50%)",
      borderRadius: "50%",
      animation: "none",
    }),
    [showHighlight],
  );

  const targetStyle = useMemo(
    () => ({
      display: "block",
      visibility: showTarget ? "visible" : "hidden",
      position: "absolute",
      top: 0,
      opacity: 0,
      left: 0,
      width: "40px",
      height: "40px",
      pointerEvents: "none",
      zIndex: 99999999999,
      border: "3px solid red",
      transform: "none",
      borderRadius: "50%",
      animation: "none",
      transition:
        "opacity .5s cubic-bezier(.25,.8,.25,1), transform .35s cubic-bezier(.25,.8,.25,1)",
    }),
    [showTarget],
  );

  return (
    <div>
      <div
        ref={cursorHighlightRef}
        className="cursor-highlight"
        style={highlightStyle}
      ></div>
      <div
        ref={cursorClickTargetRef}
        className="cursor-click-target"
        style={targetStyle}
      ></div>
      <div
        ref={spotlightRef}
        className="spotlight"
        style={{
          position: "absolute",
          display: showSpotlight ? "block" : "none",
          top: lastMousePosition.y + "px",
          left: lastMousePosition.x + "px",
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 99999999999,
        }}
      ></div>
      <style>
        {`
					@keyframes scaleDown {
							from {
									transform: translate(-50%, -50%) scale(1);
									opacity: 1;
							}
							to {
									transform: translate(-50%, -50%) scale(0);
									opacity: 0;
							}
					`}
      </style>
    </div>
  );
};

export default CursorModes;
