import React, { useEffect, useRef } from "react";

const Sandbox = () => {
  const iframeRef = useRef(null);

  const sendMessage = (message) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, "*");
    }
  };

  const onMessage = async (message) => {
    if (message.type === "load-ffmpeg") {
      sendMessage({ type: "ffmpeg-load-error", fallback: true });
    } else if (
      message.type === "add-audio-to-video" ||
      message.type === "base64-to-blob" ||
      message.type === "crop-video" ||
      message.type === "cut-video" ||
      message.type === "mute-video" ||
      message.type === "reencode-video" ||
      message.type === "to-gif"
    ) {
      sendMessage({
        type: "ffmpeg-error",
        error:
          "Processing not available in viewer mode. Please use a modern browser (Chrome 94+) for editing features.",
      });
    }
  };

  useEffect(() => {
    const handler = (event) => onMessage(event.data);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div>
      <iframe
        ref={iframeRef}
        src={`sandbox.html${window.location.search || ""}`}
        allowFullScreen
        style={{
          width: "100%",
          border: "none",
          height: "100vh",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
};

export default Sandbox;
