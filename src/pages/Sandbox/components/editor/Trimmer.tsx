import React, { useRef, useEffect, useState, useContext } from "react";
import styles from "../../styles/edit/_Trimmer.module.scss";
import WaveformGenerator from "./Waveform";

// Context
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const Trimmer = (props) => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context

  const trimmerRef = useRef(null);
  const startHandleRef = useRef(null);
  const endHandleRef = useRef(null);
  const isDragging = useRef(false);
  const activeHandle = useRef(null);

  const handleMouseDown = (e, handle) => {
    e.preventDefault();
    isDragging.current = true;
    activeHandle.current = handle;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;

    const trimmerRect = trimmerRef.current.getBoundingClientRect();
    const trimmerWidth = trimmerRect.width;
    const mouseX = e.clientX - trimmerRect.left;
    let newPosition = mouseX / trimmerWidth;

    if (activeHandle.current === "start") {
      newPosition += 0;
      const validPosition = Math.max(
        Math.min(newPosition, contentState.end - 0.02),
        0
      );
      setContentState((prevContentState) => ({
        ...prevContentState,
        start: validPosition,
      }));
    } else if (activeHandle.current === "end") {
      newPosition -= 0;
      const validPosition = Math.min(
        Math.max(newPosition, contentState.start + 0.02),
        1
      );
      setContentState((prevContentState) => ({
        ...prevContentState,
        end: validPosition,
      }));
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    activeHandle.current = null;

    contentState.addToHistory();

    setContentState((prevContentState) => ({
      ...prevContentState,
      dragInteracted: true,
    }));

    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    // Update the handle positions when the start and end values change
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
