import React, { useState, useEffect, useContext, useRef } from "react";

// Context
import { contentStateContext } from "../context/ContentState";

const COUNTDOWN_TIME = 3;

const Countdown = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [count, setCount] = useState(COUNTDOWN_TIME);
  const [isTransforming, setIsTransforming] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const timers = useRef([]);

  // Cleanup function to clear all timers
  const cleanupTimers = () => {
    timers.current.forEach((timer) => {
      if (timer.type === "interval") {
        clearInterval(timer.id);
      } else {
        clearTimeout(timer.id);
      }
    });
    timers.current = [];
  };

  // Handle cancellation
  const handleCancel = () => {
    if (contentState.countdownActive) {
      cleanupTimers();
      setCount(COUNTDOWN_TIME);
      setIsTransforming(false);
      setIsRotating(false);
      contentState.cancelCountdown();
    }
  };

  // Countdown logic
  useEffect(() => {
    if (contentState.countdownActive && count > 1) {
      const intervalId = setInterval(() => {
        if (!contentState.countdownCancelled) {
          setCount((prev) => prev - 1);
        }
      }, 1000);

      timers.current.push({ id: intervalId, type: "interval" });

      return () => {
        clearInterval(intervalId);
        timers.current = timers.current.filter((t) => t.id !== intervalId);
      };
    } else if (contentState.countdownActive && count === 1) {
      const timeoutId = setTimeout(() => {
        if (!contentState.countdownCancelled && contentState.countdownActive) {
          contentState.startRecordingAfterCountdown();
          setContentState((prev) => ({
            ...prev,
            isCountdownVisible: false,
            countdownActive: false,
          }));
        }
      }, 1000);

      timers.current.push({ id: timeoutId, type: "timeout" });

      return () => {
        clearTimeout(timeoutId);
        timers.current = timers.current.filter((t) => t.id !== timeoutId);
      };
    }
  }, [contentState.countdownActive, count, setContentState, contentState]);

  // Start animation when countdown becomes visible
  useEffect(() => {
    if (contentState.isCountdownVisible) {
      contentState.resetCountdown(); // Reset cancelled state
      setCount(COUNTDOWN_TIME);
      setIsTransforming(true);

      const rotateId = setTimeout(() => {
        if (!contentState.countdownCancelled) {
          setIsRotating(true);
        }
      }, 10);

      const transformId = setTimeout(() => {
        if (!contentState.countdownCancelled) {
          setIsTransforming(false);
        }
      }, (COUNTDOWN_TIME * 1000) / 2);

      timers.current.push(
        { id: rotateId, type: "timeout" },
        { id: transformId, type: "timeout" }
      );

      return () => {
        clearTimeout(rotateId);
        clearTimeout(transformId);
        timers.current = timers.current.filter(
          (t) => t.id !== rotateId && t.id !== transformId
        );
      };
    }
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
