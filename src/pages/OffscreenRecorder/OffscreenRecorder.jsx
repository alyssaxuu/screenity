import React, { useEffect } from "react";
import CloudRecorder from "../CloudRecorder/CloudRecorder";
import Recorder from "../Recorder/Recorder";

// ?cloud=1 → CloudRecorder (TUS), ?resume=1 → silent upload resume, default → local Recorder.
const urlParams = new URLSearchParams(window.location.search);
const IS_CLOUD = urlParams.get("cloud") === "1";
const IS_RESUME = urlParams.get("resume") === "1";

const OffscreenRecorder = () => {
  useEffect(() => {
    if (IS_RESUME) return;
    chrome.runtime.sendMessage({ type: "offscreen-ready" }).catch((err) => {
      console.warn("[OffscreenRecorder] offscreen-ready send failed", err);
    });
  }, []);

  if (IS_RESUME) {
    return null; // minimal shell, handler runs in index.jsx
  }
  return IS_CLOUD ? <CloudRecorder /> : <Recorder />;
};

export default OffscreenRecorder;
