import React, { useContext, useEffect, useRef, useState } from "react";
import { contentStateContext } from "../context/ContentState";

const CursorModes = () => {
  const [contentState] = useContext(contentStateContext);
  const modeRef = useRef(contentState.cursorMode);

  // Track mouse position for spotlight and highlight cursor
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Store all click coordinates here (persistent without re-render)
  const clickCoordinatesRef = useRef([]);

  // Debounce timer for saving clicks
  const saveTimeoutRef = useRef(null);

  // Update modeRef when cursorMode changes
  useEffect(() => {
    modeRef.current = contentState.cursorMode;
  }, [contentState.cursorMode]);

  // Save clicks to chrome.storage.local debounced
  // const saveClickCoordinatesDebounced = () => {
  //   if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  //   saveTimeoutRef.current = setTimeout(() => {
  //     chrome.storage.local.set(
  //       { clickCoordinates: clickCoordinatesRef.current },
  //       () => {
  //         // console.log("Click coordinates saved:", clickCoordinatesRef.current.length);
  //       }
  //     );
  //   }, 500);
  // };

  // On mouse move, update position state for cursor elements (no saving)
  const mouseMoveHandler = (e) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
    updateCursorPosition(e.clientX, e.clientY);
  };

  // On mouse down, save click coordinate and animate click target
  const mouseDownHandler = (e) => {
   

// On click
    //  chrome.storage.local.get("savedTime", (result) => {
    //   if (!result.savedTime) {
    //     console.log("No start time found, skipping click coordinate.");
    //     return; // ✅ Do nothing if startTime is not set
    //   }

    //   let startTime = result.savedTime / 1000;
    //   console.log(startTime, "startTimestartTimestartTime");

    //   const currentTime = Date.now() / 1000;
    //   const clickTime = currentTime - startTime;

    //   const clickCoord = {
    //     x: e.clientX,
    //     y: e.clientY,
    //     time: clickTime
    //   };

    //   console.log(clickCoord);

    //   clickCoordinatesRef.current.push(clickCoord);
    // });




    // saveClickCoordinatesDebounced();

    if (modeRef.current === "target" && clickTargetRef.current) {
      clickTargetRef.current.style.transform = "translate(-50%, -50%) scale(1)";
      clickTargetRef.current.style.opacity = "1";
      // Position click target at click location immediately:
      updateCursorPosition(e.clientX, e.clientY);
    }
  };

  const mouseUpHandler = () => {
    if (modeRef.current === "target" && clickTargetRef.current) {
      clickTargetRef.current.style.transform = "translate(-50%, -50%) scale(0)";
      clickTargetRef.current.style.opacity = "0";
      // Reset scale after animation
      window.setTimeout(() => {
        if (clickTargetRef.current) {
          clickTargetRef.current.style.transform = "translate(-50%, -50%) scale(1)";
        }
      }, 350);
    }
  };

  // Cursor element refs
  const clickTargetRef = useRef(null);
  const highlightRef = useRef(null);
  const spotlightRef = useRef(null);

  // Update cursor element positions on mouse move or scroll
  const updateCursorPosition = (x, y) => {
    const scrollTop = window.scrollY;
    const scrollLeft = window.scrollX;

    if (modeRef.current === "target" && clickTargetRef.current) {
      clickTargetRef.current.style.top = y + scrollTop + "px";
      clickTargetRef.current.style.left = x + scrollLeft + "px";
    } else if (modeRef.current === "highlight" && highlightRef.current) {
      highlightRef.current.style.top = y + scrollTop + "px";
      highlightRef.current.style.left = x + scrollLeft + "px";
    } else if (modeRef.current === "spotlight" && spotlightRef.current) {
      spotlightRef.current.style.top = y + scrollTop + "px";
      spotlightRef.current.style.left = x + scrollLeft + "px";
    }
  };

  // On scroll, reposition cursor elements
  const scrollHandler = () => {
    updateCursorPosition(mousePosition.x, mousePosition.y);
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
    };
  }, []);

  // Update position of cursor elements on mousePosition change
  useEffect(() => {
    updateCursorPosition(mousePosition.x, mousePosition.y);
  }, [mousePosition]);

  return (
    <>
      <div
        ref={highlightRef}
        className="cursor-highlight"
        style={{
          display: "block",
          visibility: contentState.cursorMode === "highlight" ? "visible" : "hidden",
          position: "absolute",
          top: 0,
          left: 0,
          width: "80px",
          height: "80px",
          pointerEvents: "none",
          zIndex: 99999999999,
          background: "yellow",
          opacity: 0.5,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          animation: "none",
        }}
      ></div>

      <div
        ref={clickTargetRef}
        className="cursor-click-target"
        style={{
          display: "block",
          visibility: contentState.cursorMode === "target" ? "visible" : "hidden",
          position: "absolute",
          top: 0,
          left: 0,
          width: "40px",
          height: "40px",
          pointerEvents: "none",
          zIndex: 99999999999,
          border: "3px solid red",
          borderRadius: "50%",
          opacity: 0,
          transform: "translate(-50%, -50%) scale(0)",
          transition:
            "opacity 0.5s cubic-bezier(.25,.8,.25,1), transform 0.35s cubic-bezier(.25,.8,.25,1)",
          animation: "none",
        }}
      ></div>

      <div
        ref={spotlightRef}
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

      <style>{`
        @keyframes scaleDown {
          from {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          to {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
};

export default CursorModes;
