import React, { useState, useEffect, useContext, useRef } from "react";

// Context
import { contentStateContext } from "../context/ContentState";

const COUNTDOWN_TIME = 3;

const Countdown = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [count, setCount] = useState(COUNTDOWN_TIME);
  const [isTransforming, setIsTransforming] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const END_HOLD_MS = 1000;
  const START_AFTER_BEEP_MS = 120;
  const HIDE_AFTER_END_MS = 0;

  const intervalRef = useRef(null);
  const activeRef = useRef(false);
  const cancelledRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const startRef = useRef(null);
  const finishRef = useRef(null);
  const resetRef = useRef(null);
  const completedRef = useRef(false);
  const hideTimeoutRef = useRef(null);
  const finishTimeoutRef = useRef(null);
  const startTimeoutRef = useRef(null);

  const cleanupTimers = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    activeRef.current = contentState.countdownActive;
    cancelledRef.current = contentState.countdownCancelled;
    startRef.current = contentState.startRecordingAfterCountdown;
    finishRef.current = contentState.onCountdownFinished;
    resetRef.current = contentState.resetCountdown;
  }, [
    contentState.countdownActive,
    contentState.countdownCancelled,
    contentState.startRecordingAfterCountdown,
    contentState.onCountdownFinished,
    contentState.resetCountdown,
  ]);

  // Handle cancellation
  const handleCancel = () => {
    if (contentState.countdownActive || contentState.isCountdownVisible) {
      cleanupTimers();
      setCount(COUNTDOWN_TIME);
      setIsTransforming(false);
      setIsRotating(false);
      contentState.cancelCountdown();
    }
  };

  // Countdown logic
  useEffect(() => {
    if (!contentState.countdownActive) {
      cleanupTimers();
      return;
    }

    cleanupTimers();
    intervalRef.current = setInterval(() => {
      setCount((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    return cleanupTimers;
  }, [contentState.countdownActive]);

  useEffect(() => {
    if (!activeRef.current || cancelledRef.current) {
      return;
    }
    if (count !== 1) {
      return;
    }
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!cancelledRef.current && activeRef.current) {
      finishTimeoutRef.current = setTimeout(() => {
        if (cancelledRef.current || !activeRef.current) {
          finishTimeoutRef.current = null;
          return;
        }
        finishRef.current?.();
        startTimeoutRef.current = setTimeout(() => {
          startRef.current?.();
          startTimeoutRef.current = null;
        }, START_AFTER_BEEP_MS);
        hideTimeoutRef.current = setTimeout(() => {
          setContentState((prev) => ({
            ...prev,
            isCountdownVisible: false,
            countdownActive: false,
          }));
          hideTimeoutRef.current = null;
        }, HIDE_AFTER_END_MS);
        finishTimeoutRef.current = null;
      }, END_HOLD_MS);
    }
  }, [count, setContentState]);

  // Start animation when countdown becomes visible
  useEffect(() => {
    if (contentState.isCountdownVisible && !wasVisibleRef.current) {
      resetRef.current?.();
      completedRef.current = false;
      setCount(COUNTDOWN_TIME);
      setIsTransforming(true);

      const rotateId = setTimeout(() => {
        if (!cancelledRef.current) {
          setIsRotating(true);
        }
      }, 10);

      const transformId = setTimeout(() => {
        if (!cancelledRef.current) {
          setIsTransforming(false);
        }
      }, (COUNTDOWN_TIME * 1000) / 2);

      return () => {
        clearTimeout(rotateId);
        clearTimeout(transformId);
      };
    }

    if (!contentState.isCountdownVisible) {
      setIsRotating(false);
      setIsTransforming(false);
    }
  }, [contentState.isCountdownVisible]);

  useEffect(() => {
    wasVisibleRef.current = contentState.isCountdownVisible;
  }, [contentState.isCountdownVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanupTimers;
  }, []);

  return (
    <div
      className={`countdown ${
        contentState.countdownActive ? "recording-countdown" : ""
      }`}
      onClick={handleCancel}
    >
      {contentState.isCountdownVisible && (
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" version="1.1">
            <defs>
              <filter id="goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="10" />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 20 -10"
                  result="goo"
                />
              </filter>
            </defs>
          </svg>

          <div className="countdown-circle">
            <div className="countdown-number">{count}</div>
            <div
              className="background"
              style={{
                transform: isRotating ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              <div
                className="circle"
                style={{
                  transform: isTransforming ? "scale(1)" : "scale(0.8)",
                }}
              ></div>
              <div className="c c2"></div>
              <div className="c c3"></div>
            </div>
          </div>

          <div className="countdown-info">
            {chrome.i18n.getMessage("countdownMessage")}
          </div>
          <div className="countdown-overlay"></div>
        </div>
      )}
    </div>
  );
};

export default Countdown;
