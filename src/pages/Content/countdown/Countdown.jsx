import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from "react";

// Context
import { contentStateContext } from "../context/ContentState";

const Countdown = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [count, setCount] = useState(3);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countActive, setCountActive] = useState(false);
  const backgroundRef = useRef(null);
  const circleRef = useRef(null);
  const c1Ref = useRef(null);
  const c2Ref = useRef(null);
  const countdownRef = useRef(contentState.countdown);
  const wrapperRef = useRef(null);
  const cancelRef = useRef(false);

  // 3, 2, 1 countdown when recording starts
  useEffect(() => {
    if (countActive && count > 1) {
      const timer = setInterval(() => {
        setCount((prevCount) => prevCount - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countActive, count]);

  const startCountdown = () => {
    if (circleRef.current === null) return;
    if (backgroundRef.current === null) return;

    setCount(3);
    cancelRef.current = false;
    wrapperRef.current.style.pointerEvents = "all";

    setTimeout(() => {
      if (circleRef.current === null) return;
      if (backgroundRef.current === null) return;
      circleRef.current.style.transform = "scale(1)";
      backgroundRef.current.style.transform = "rotate(90deg)";
    }, 10);
    setTimeout(() => {
      if (circleRef.current === null) return;
      circleRef.current.style.transform = "scale(.8)";
    }, (count * 1000) / 2);
  };

  useEffect(() => {
    countdownRef.current = contentState.countdown;
  }, [contentState.countdown]);

  const onMessage = useCallback(
    (request, sender, sendResponse) => {
      if (request.type === "ready-to-record") {
        if (countdownRef.current) {
          setCountActive(true);
          setShowCountdown(true);
          startCountdown();

          setTimeout(() => {
            if (!cancelRef.current) {
              setShowCountdown(false);
              setCountActive(false);
              cancelRef.current = false;
              setCount(3);
              wrapperRef.current.style.pointerEvents = "none";

              // Play beep sound at 50% volume
              const audio = new Audio(
                chrome.runtime.getURL("/assets/sounds/beep2.mp3")
              );
              audio.volume = 0.5;
              audio.play();
              setTimeout(() => {
                contentState.startRecording();
              }, 500);
            }
          }, count * 1000);
        } else {
          if (!cancelRef.current) {
            // Play beep sound at 50% volume
            const audio = new Audio(
              chrome.runtime.getURL("/assets/sounds/beep2.mp3")
            );
            audio.volume = 0.5;
            audio.play();
            setShowCountdown(false);
            setCountActive(false);
            setTimeout(() => {
              contentState.startRecording();
            }, 500);
          }
        }
      }
    },
    [countdownRef, contentState, cancelRef.current]
  );

  useEffect(() => {
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      setCountActive(false);
      setShowCountdown(false);
      setCount(3);
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  // I need to make a 3, 2, 1 countdown, full screen (black overlay with the number in a circle on the middle), with a beep at the end
  return (
    <div
      className={!countActive ? "countdown" : "countdown recording-countdown"}
      onClick={() => {
        if (countActive) {
          cancelRef.current = true;
          wrapperRef.current.style.pointerEvents = "none";
          setCountActive(false);
          setShowCountdown(false);
          setCount(3);
          contentState.dismissRecording();
          setContentState((prevContentState) => ({
            ...prevContentState,
            recording: false,
            showPopup: true,
            showExtension: true,
          }));
        }
      }}
      ref={wrapperRef}
    >
      {showCountdown && (
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
            <div className="background" ref={backgroundRef}>
              <div className="circle" ref={circleRef}></div>
              <div className="c c2" ref={c1Ref}></div>
              <div className="c c3" ref={c2Ref}></div>
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
