import React, { useState, useEffect, useContext, useRef } from "react";

// Context
import { contentStateContext } from "../context/ContentState";

const CursorModes = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const modeRef = useRef(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    modeRef.current = contentState.cursorMode;
  }, [contentState.cursorMode]);

  const mouseDownHandler = (e) => {
    if (modeRef.current === "target") {
      document.querySelector(".cursor-click-target").style.transform =
        "translate(-50%, -50%) scale(1)";
      document.querySelector(".cursor-click-target").style.opacity = "1";
    }
  };

  const mouseUpHandler = (e) => {
    if (modeRef.current === "target") {
      document.querySelector(".cursor-click-target").style.transform =
        "translate(-50%, -50%) scale(0)";
      document.querySelector(".cursor-click-target").style.opacity = "0";

      window.setTimeout(() => {
        document.querySelector(".cursor-click-target").style.transform =
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

    const cursorElement =
      modeRef.current === "target"
        ? document.querySelector(".cursor-click-target")
        : modeRef.current === "highlight"
        ? document.querySelector(".cursor-highlight")
        : document.querySelector(".spotlight");

    if (cursorElement) {
      cursorElement.style.top = lastMouseRef.current.y + scrollTop + "px";
      cursorElement.style.left = lastMouseRef.current.x + scrollLeft + "px";
    }
  };

  const mouseMoveHandler = (e) => {
    setLastMousePosition({ x: e.clientX, y: e.clientY });
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
            contentState.cursorMode === "highlight" ? "visible" : "hidden",
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
            contentState.cursorMode === "target" ? "visible" : "hidden",
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
          display: contentState.cursorMode === "spotlight" ? "block" : "none",
          top: mousePosition.y + "px",
          left: mousePosition.x + "px",
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
