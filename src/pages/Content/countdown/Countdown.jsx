import React, { useState, useEffect, useContext, useRef } from "react";

// Context
import { contentStateContext } from "../context/ContentState";

const COUNTDOWN_TIME = 3;
const DEBUG_START_FLOW =
  typeof window !== "undefined" ? !!window.SCREENITY_DEBUG_RECORDER : false;

const Countdown = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [count, setCount] = useState(COUNTDOWN_TIME);
  const [isTransforming, setIsTransforming] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const END_HOLD_MS = 1000;
  const POST_HIDE_START_DELAY_MS = 150;
  const HIDE_AFTER_END_MS = 0;

  const intervalRef = useRef(null);
  const activeRef = useRef(false);
  const cancelledRef = useRef(false);
  const wasVisibleRef = useRef(false);
  const finishRef = useRef(null);
  const resetRef = useRef(null);
  const completedRef = useRef(false);
  const hideTimeoutRef = useRef(null);
  const finishTimeoutRef = useRef(null);
  const startTimeoutRef = useRef(null);
  const startAtRef = useRef(0);
  const runIdRef = useRef(0);

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

  const logStartFlow = (event, data = {}) => {
    if (!DEBUG_START_FLOW) return;
    const payload = { ts: Date.now(), event, ...data };
    console.info("[Screenity][StartFlow]", payload);
    try {
      const update = {
        startFlowDebug: {
          ...(data || {}),
          event,
          ts: payload.ts,
        },
      };
      if (event === "countdown_start") {
        update.countdownVisibleAt = payload.ts;
      } else if (event === "countdown_end") {
        update.countdownHiddenAt = payload.ts;
      }
      chrome.storage.local.set(update);
    } catch {}
  };

  useEffect(() => {
    activeRef.current = contentState.countdownActive;
    cancelledRef.current = contentState.countdownCancelled;
    finishRef.current = contentState.onCountdownFinished;
    resetRef.current = contentState.resetCountdown;
  }, [
    contentState.countdownActive,
    contentState.countdownCancelled,
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
      completedRef.current = false;
      logStartFlow("countdown_cancel", { visible: false });
      contentState.cancelCountdown();
    }
  };

  // Countdown logic
  useEffect(() => {
    if (!contentState.countdownActive) {
      cleanupTimers();
      completedRef.current = false;
      return;
    }

    cleanupTimers();
    // Reset immediately at run start so a stale previous `1` cannot
    // short-circuit the next countdown cycle.
    setCount(COUNTDOWN_TIME);
    completedRef.current = false;
    runIdRef.current += 1;
    const runId = runIdRef.current;
    startAtRef.current = performance.now();
    logStartFlow("countdown_start", { visible: true });

    const tick = () => {
      if (runIdRef.current !== runId) return;
      if (!activeRef.current || cancelledRef.current) return;
      const elapsedMs = performance.now() - startAtRef.current;
      const remainingMs = Math.max(0, COUNTDOWN_TIME * 1000 - elapsedMs);
      const nextCount = Math.max(1, Math.ceil(remainingMs / 1000));
      setCount(nextCount);

      if (remainingMs <= 0) {
        return;
      }

      intervalRef.current = setTimeout(tick, 100);
    };

    intervalRef.current = setTimeout(tick, 100);

    return cleanupTimers;
  }, [contentState.countdownActive]);

  useEffect(() => {
    if (!activeRef.current || cancelledRef.current) {
      return;
    }
    if (count !== 1) {
      return;
    }
    const elapsedMs = performance.now() - startAtRef.current;
    // Ignore stale count=1 carried from a previous run; valid final-second
    // entry happens after ~2s for a 3..2..1 countdown.
    if (elapsedMs < (COUNTDOWN_TIME - 1) * 1000) {
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
        setContentState((prev) => ({
          ...prev,
          isCountdownVisible: false,
          countdownActive: false,
        }));
        const endedAt = Date.now();
        const dispatchStartAfterHide = () => {
          if (cancelledRef.current) return;
          const startDispatchedAt = Date.now();
          logStartFlow("countdown_end", {
            visible: false,
            endedAt,
            startDispatchedAt,
          });
          chrome.storage.local.set({
            countdownFinishedAt: endedAt,
            lastCountdownStartGate: {
              endedAt,
              countdownHiddenAt: endedAt,
              startDispatchedAt,
              overlayVisible: false,
              ts: startDispatchedAt,
            },
          });
          finishRef.current?.();
          // Countdown-enabled flow should start from background only.
          // Waiting briefly after hide avoids capturing the countdown frame.
          startTimeoutRef.current = setTimeout(() => {
            if (cancelledRef.current) {
              startTimeoutRef.current = null;
              return;
            }
            chrome.runtime
              .sendMessage({
                type: "countdown-finished",
                endedAt,
              })
              .catch(() => {});
            startTimeoutRef.current = null;
          }, POST_HIDE_START_DELAY_MS);
        };
        // Wait for at least one paint after hidden state commit.
        requestAnimationFrame(() => {
          requestAnimationFrame(dispatchStartAfterHide);
        });
        hideTimeoutRef.current = setTimeout(() => {
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
