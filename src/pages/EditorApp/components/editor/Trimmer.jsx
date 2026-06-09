import React, { useRef, useEffect, useState, useContext } from "react";
import styles from "../../styles/edit/_Trimmer.module.scss";
import WaveformGenerator from "./Waveform";

import { ContentStateContext } from "../../context/ContentState";

const Trimmer = (props) => {
  const [contentState, setContentState] = useContext(ContentStateContext);

  const trimmerRef = useRef(null);
  const startHandleRef = useRef(null);
  const endHandleRef = useRef(null);
  const isDragging = useRef(false);
  const activeHandle = useRef(null);
  // Refs so doc-level mousemove/mouseup don't re-bind per render and leak
  // listeners with stale bounds.
  const setContentStateRef = useRef(setContentState);
  const addToHistoryRef = useRef(null);
  const startBoundRef = useRef(0);
  const endBoundRef = useRef(1);

  useEffect(() => {
    setContentStateRef.current = setContentState;
    addToHistoryRef.current = contentState.addToHistory;
    startBoundRef.current = contentState.start;
    endBoundRef.current = contentState.end;
  });

  const handleMouseMoveRef = useRef(null);
  const handleMouseUpRef = useRef(null);

  if (!handleMouseMoveRef.current) {
    handleMouseMoveRef.current = (e) => {
      if (!isDragging.current) return;
      const trimmerRect = trimmerRef.current?.getBoundingClientRect();
      if (!trimmerRect) return;
      const trimmerWidth = trimmerRect.width;
      const mouseX = e.clientX - trimmerRect.left;
      const newPosition = mouseX / trimmerWidth;

      if (activeHandle.current === "start") {
        const validPosition = Math.max(
          Math.min(newPosition, endBoundRef.current - 0.02),
          0,
        );
        setContentStateRef.current((prev) => ({
          ...prev,
          start: Math.min(validPosition, prev.end - 0.02),
        }));
      } else if (activeHandle.current === "end") {
        const validPosition = Math.min(
          Math.max(newPosition, startBoundRef.current + 0.02),
          1,
        );
        setContentStateRef.current((prev) => ({
          ...prev,
          end: Math.max(validPosition, prev.start + 0.02),
        }));
      }
    };
  }
  if (!handleMouseUpRef.current) {
    handleMouseUpRef.current = () => {
      isDragging.current = false;
      activeHandle.current = null;
      try {
        addToHistoryRef.current?.();
      } catch {}
      setContentStateRef.current((prev) => ({
        ...prev,
        dragInteracted: true,
      }));
      document.removeEventListener("mousemove", handleMouseMoveRef.current);
      document.removeEventListener("mouseup", handleMouseUpRef.current);
    };
  }

  // Cleanup if component unmounts mid-drag.
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMoveRef.current);
      document.removeEventListener("mouseup", handleMouseUpRef.current);
    };
  }, []);

  const handleMouseDown = (e, handle) => {
    e.preventDefault();
    isDragging.current = true;
    activeHandle.current = handle;
    document.addEventListener("mousemove", handleMouseMoveRef.current);
    document.addEventListener("mouseup", handleMouseUpRef.current);
  };

  useEffect(() => {
    startHandleRef.current.style.left = `calc(${contentState.start * 100}%)`;
    endHandleRef.current.style.left = `${contentState.end * 100}%`;
  }, [contentState.start, contentState.end]);

  return (
    <div>
      <div className={styles.trimmerContainer} ref={trimmerRef}>
        <div className={styles.trimWrap}>
          <div
            className={styles.leftOverlay}
            style={{ width: `${contentState.start * 100}%` }}
          />
          <div
            className={styles.rightOverlay}
            style={{ width: `${(1 - contentState.end) * 100}%` }}
          />
          <div
            className={styles.trimSection}
            style={{
              width: `${(contentState.end - contentState.start) * 100}%`,
              left: `${contentState.start * 100}%`,
            }}
          />
          <div className={styles.trimmer}>
            <div
              className={`${styles.handle} ${styles.startHandle}`}
              onMouseDown={(e) => handleMouseDown(e, "start")}
              ref={startHandleRef}
            />
            <div
              className={`${styles.handle} ${styles.endHandle}`}
              onMouseDown={(e) => handleMouseDown(e, "end")}
              ref={endHandleRef}
            />
          </div>
        </div>
        <WaveformGenerator />
      </div>
    </div>
  );
};

export default Trimmer;
