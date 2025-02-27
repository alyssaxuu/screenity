import React, { useState, useEffect, useRef, useContext } from "react";

// Context
import { contentStateContext } from "../context/ContentState";

const ZoomContainer = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [zoomLevel, setZoomLevel] = useState(1);
  const scaleRef = useRef(1);
  const translateXRef = useRef(0);
  const translateYRef = useRef(0);
  const cursorXRef = useRef(0);
  const cursorYRef = useRef(0);
  const isKeyDownRef = useRef(false);
  const isKeyUpRef = useRef(false);
  const zoomSelector = useRef(null);
  const oldPosition = useRef(null);
  const oldWidth = useRef(null);
  const oldHeight = useRef(null);
  const oldOverflow = useRef(null);
  const oldTop = useRef(null);
  const oldLeft = useRef(null);
  const contentStateRef = useRef(contentState);
  const observer = useRef(null);

  useEffect(() => {
    oldPosition.current = document.body.style.position;
    oldWidth.current = document.body.style.width;
    oldHeight.current = document.body.style.height;
    oldOverflow.current = document.body.style.overflow;
    oldTop.current = document.body.style.top;
    oldLeft.current = document.body.style.left;
  }, []);

  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);

  const handleKeyDown = (e) => {
    // Alt / Option + Shift + Z
    if (e.code === "KeyE" && e.altKey && e.shiftKey) {
      //if (!contentStateRef.current.recording) return;
      if (!contentStateRef.current.zoomEnabled) return;
      if (isKeyDownRef.current) return;
      isKeyDownRef.current = true;
      zoomIn();
    }
  };

  const handleKeyUp = (e) => {
    if (e.code === "KeyE" || e.altKey || e.shiftKey) {
      isKeyDownRef.current = false;
      isKeyUpRef.current = true;
      zoomOut();

      setTimeout(() => {
        isKeyUpRef.current = false;
        setTimeout(() => {
          enableScrolling();
        }, 500);
      }, 500);
    }
  };

  const handleMouseMove = (e) => {
    //if (!contentStateRef.current.recording) return;
    if (!contentStateRef.current.zoomEnabled) return;

    const { top, left } = document.documentElement.getBoundingClientRect();

    cursorXRef.current = e.clientX - left;
    cursorYRef.current = e.clientY - top;
    applyTransform();
  };

  const zoomIn = () => {
    scaleRef.current *= 1.5;
    setZoomLevel(scaleRef.current);
    applyTransformWithTransition();
    preventScrolling();
  };

  const zoomOut = () => {
    scaleRef.current = 1;
    translateXRef.current = 0;
    translateYRef.current = 0;
    setZoomLevel(scaleRef.current);
    //applyTransformWithTransition();
    //enableScrolling();
  };

  const applyTransform = () => {
    if (!zoomSelector.current) return;
    //if (!contentStateRef.current.recording) return;
    const { current: scale } = scaleRef;
    const { current: translateX } = translateXRef;
    const { current: translateY } = translateYRef;

    const originX = cursorXRef.current - translateX;
    const originY = cursorYRef.current - translateY;

    zoomSelector.current.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
    zoomSelector.current.style.transformOrigin = `${originX}px ${originY}px`;

    // I also need to apply the transform to the #canvas-wrapper, if it exists
    const canvasWrapper = document.querySelector("#canvas-wrapper-screenity");

    // Substract scroll position
    const fixedOriginX = originX - window.scrollX;
    const fixedOriginY = originY - window.scrollY;
    if (canvasWrapper) {
      canvasWrapper.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
      canvasWrapper.style.transformOrigin = `${fixedOriginX}px ${fixedOriginY}px`;
    }

    // Also to #mockup-wrapper
    //const mockupWrapper = document.querySelector("#mockup-wrapper");
    //if (mockupWrapper) {
    //  mockupWrapper.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
    //  mockupWrapper.style.transformOrigin = `${originX}px ${originY}px`;
    //}
  };

  const applyTransformWithTransition = () => {
    if (!zoomSelector.current) return;

    zoomSelector.current.style.transition = "transform 0.5s";
    if (document.querySelector("#canvas-wrapper-screenity")) {
      document.querySelector("#canvas-wrapper-screenity").style.transition =
        "transform 0.5s";
    }
    //if (document.querySelector("#mockup-wrapper")) {
    //  document.querySelector("#mockup-wrapper").style.transition =
    //    "transform 0.5s";
    //}
    applyTransform();
  };

  const preventScrolling = () => {
    /*
    zoomSelector.current.style.position = "fixed";
    zoomSelector.current.style.top = "0";
    zoomSelector.current.style.left = "0";
    zoomSelector.current.style.overflow = "hidden";
    zoomSelector.current.style.width = "100vw";
    zoomSelector.current.style.height = "100vh";
		*/
  };

  const enableScrolling = () => {
    if (!zoomSelector.current) return;
    zoomSelector.current.style.position = oldPosition.current;
    zoomSelector.current.style.top = oldTop.current;
    zoomSelector.current.style.left = oldLeft.current;
    zoomSelector.current.style.overflow = oldOverflow.current;
    zoomSelector.current.style.width = oldWidth.current;
    zoomSelector.current.style.height = oldHeight.current;
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [contentState.zoomEnabled, contentState.showExtension]);

  useEffect(() => {
    if (!contentState.zoomEnabled) return;
    if (!contentState.showPopup) return;

    setTimeout(() => {
      //if (!contentState.recording) return;
      if (document.querySelector("#screenity-zoom-wrap")) return;
      const div = document.createElement("div");
      div.id = "screenity-zoom-wrap";
      div.style.width = "100vw";
      div.style.height = "100vh";

      // Move the body's children into this wrapper
      while (
        document.body.firstChild &&
        document.body.firstChild.id !== "screenity-ui"
      ) {
        if (document.body.firstChild.id !== "screenity-ui") {
          div.appendChild(document.body.firstChild);
        }
      }

      // Append the wrapper to the body
      document.body.prepend(div);

      document.body.appendChild(document.getElementById("screenity-ui"));
      zoomSelector.current = document.querySelector("#screenity-zoom-wrap");

      observer.current = new MutationObserver((mutations) => {
        if (!contentState.showExtension) {
          mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
              const screenityUi = document.querySelector("#screenity-ui");
              if (screenityUi) {
                // Disconnect the observer
                observer.current.disconnect();
              }
            }
          });
        }
      });

      observer.current.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }, 500);

    return () => {
      setTimeout(() => {
        if (observer.current && typeof observer.current === "object") {
          observer.current.disconnect();
        }
        const zoomWrap = document.querySelector("#screenity-zoom-wrap");
        if (zoomWrap) {
          while (zoomWrap.firstChild) {
            document.body.prepend(zoomWrap.firstChild);
          }

          if (document.body.contains(zoomWrap)) {
            document.body.removeChild(zoomWrap);
          }
        }
        // reset
        scaleRef.current = 1;
        translateXRef.current = 0;
        translateYRef.current = 0;
        setZoomLevel(scaleRef.current);
      }, 500);
    };
  }, [contentState.zoomEnabled, contentState.showExtension]);

  useEffect(() => {
    setTimeout(() => {
      if (!contentState.zoomEnabled || !contentState.showExtension) {
        const zoomWrap = document.querySelector("#screenity-zoom-wrap");
        if (zoomWrap) {
          while (zoomWrap.firstChild) {
            document.body.prepend(zoomWrap.firstChild);
          }

          if (document.body.contains(zoomWrap)) {
            document.body.removeChild(zoomWrap);
          }
        }
        // reset
        scaleRef.current = 1;
        translateXRef.current = 0;
        translateYRef.current = 0;
        setZoomLevel(scaleRef.current);
      }
    }, 500);
  }, [contentState.zoomEnabled, contentState.showExtension]);

  useEffect(() => {
    if (!zoomSelector.current) return;
    //if (!contentStateRef.current.recording) return;
    if (!contentStateRef.current.zoomEnabled) return;
    if (isKeyDownRef.current || isKeyUpRef.current) {
      //preventScrolling();
      applyTransform();
    }
  }, [zoomLevel]);

  return null;
};

export default ZoomContainer;
