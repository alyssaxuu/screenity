import React, { useState, useEffect, useContext, useRef } from "react";

// Context
import { contentStateContext } from "../context/ContentState";

const CursorModes = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const effectsRef = useRef(new Set());

  useEffect(() => {
    const nextEffects = Array.isArray(contentState.cursorEffects)
      ? contentState.cursorEffects
      : [];
    effectsRef.current = new Set(nextEffects);
  }, [contentState.cursorEffects]);

  const mouseDownHandler = (e) => {
    if (effectsRef.current.has("target")) {
      const target = document.querySelector(".cursor-click-target");
      if (!target) return;
      target.style.transform =
        "translate(-50%, -50%) scale(1)";
      target.style.opacity = "1";
    }
  };

  const mouseUpHandler = (e) => {
    if (effectsRef.current.has("target")) {
      const target = document.querySelector(".cursor-click-target");
      if (!target) return;
      target.style.transform =
        "translate(-50%, -50%) scale(0)";
      target.style.opacity = "0";

      window.setTimeout(() => {
        const targetReset = document.querySelector(".cursor-click-target");
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

    if (effectsRef.current.has("target")) {
      const target = document.querySelector(".cursor-click-target");
      if (target) {
        target.style.top = lastMouseRef.current.y + scrollTop + "px";
        target.style.left = lastMouseRef.current.x + scrollLeft + "px";
      }
    }

    if (effectsRef.current.has("highlight")) {
      const highlight = document.querySelector(".cursor-highlight");
      if (highlight) {
        highlight.style.top = lastMouseRef.current.y + scrollTop + "px";
        highlight.style.left = lastMouseRef.current.x + scrollLeft + "px";
      }
    }

    if (effectsRef.current.has("spotlight")) {
      const spotlight = document.querySelector(".spotlight");
      if (spotlight) {
        spotlight.style.top = lastMouseRef.current.y + scrollTop + "px";
        spotlight.style.left = lastMouseRef.current.x + scrollLeft + "px";
      }
    }
  };

  const mouseMoveHandler = (e) => {
    const next = { x: e.clientX, y: e.clientY };
    lastMouseRef.current = next;
    setLastMousePosition(next);
    updateCursorPosition();
  };

  const scrollHandler = () => {
    updateCursorPosition();
  };

  // Show click target when user clicks anywhere for 1 second, animate scale up and fade out
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
    };
  }, []);

  return (
    <div>
      <div
        className="cursor-highlight"
        style={{
          display: "block",
          visibility:
            contentState.cursorEffects?.includes("highlight")
              ? "visible"
              : "hidden",
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
        }}
      ></div>
      <div
        className="cursor-click-target"
        style={{
          display: "block",
          visibility:
            contentState.cursorEffects?.includes("target")
              ? "visible"
              : "hidden",
          position: "absolute",
          top: 0,
          opacity: 0,
          left: 0,
          width: "40px",
          height: "40px",
          transform: "translate(-50%, -50%) scale(1)",
          pointerEvents: "none",
          zIndex: 99999999999,
          border: "3px solid red",
          transform: "none",
          borderRadius: "50%",
          animation: "none",
          transition:
            "opacity .5s cubic-bezier(.25,.8,.25,1), transform .35s cubic-bezier(.25,.8,.25,1)",
        }}
      ></div>
      <div
        className="spotlight"
        style={{
          position: "absolute",
          display: contentState.cursorEffects?.includes("spotlight")
            ? "block"
            : "none",
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
