import React, { useState } from "react";

const BTN = {
  padding: "4px 8px",
  fontSize: "11px",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "4px",
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const BTN_RESET = { ...BTN, background: "rgba(200,50,50,0.7)" };
const Z = 2147483647;

const DevHUD = ({ setContentState, contentStateRef }) => {
  const [collapsed, setCollapsed] = useState(true);

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{
          position: "fixed",
          top: 6,
          right: 6,
          zIndex: Z,
          background: "rgba(0,0,0,0.65)",
          color: "#0f0",
          fontSize: "10px",
          padding: "3px 7px",
          borderRadius: "4px",
          cursor: "pointer",
          fontFamily: "monospace",
        }}
      >
        DEV
      </div>
    );
  }

  const actions = [
    {
      label: "Stuck processing",
      fn: () =>
        setContentState((p) => ({
          ...p,
          ready: false,
          processingProgress: 0,
        })),
    },
    {
      label: "Processing 50%",
      fn: () =>
        setContentState((p) => ({
          ...p,
          ready: false,
          processingProgress: 50,
        })),
    },
    {
      label: "Recovery mode",
      fn: () =>
        setContentState((p) => ({
          ...p,
          fallback: true,
          noffmpeg: true,
          editLimit: 3600,
          ready: true,
          editErrorType: null,
          offline: false,
          webm: p.webm || p.rawBlob || p.blob,
        })),
    },
    {
      label: "Long recording",
      fn: () =>
        setContentState((p) => ({
          ...p,
          fallback: true,
          noffmpeg: true,
          editLimit: 0,
          ready: true,
          editErrorType: null,
          offline: false,
          webm: p.webm || p.rawBlob || p.blob,
        })),
    },
    {
      label: "Encoding (FFmpeg)",
      fn: () =>
        setContentState((p) => ({
          ...p,
          ready: true,
          isFfmpegRunning: true,
          mp4ready: false,
          noffmpeg: false,
          fallback: false,
          editErrorType: null,
          offline: false,
          duration: Math.min(p.duration || 10, p.editLimit || 3600),
        })),
    },
    {
      label: "MP4 not ready",
      fn: () =>
        setContentState((p) => ({
          ...p,
          ready: true,
          mp4ready: false,
          isFfmpegRunning: false,
          noffmpeg: false,
          fallback: false,
          editErrorType: null,
          offline: false,
          duration: Math.min(p.duration || 10, p.editLimit || 3600),
        })),
    },
    {
      label: "Edit timeout",
      fn: () =>
        setContentState((p) => ({
          ...p,
          editErrorType: "timeout",
          fallback: false,
        })),
    },
    {
      label: "Edit failed",
      fn: () =>
        setContentState((p) => ({
          ...p,
          editErrorType: "failed",
          fallback: false,
        })),
    },
    {
      label: "Edit too long",
      fn: () =>
        setContentState((p) => ({
          ...p,
          editErrorType: "too-long",
          fallback: false,
        })),
    },
    {
      label: "Offline",
      fn: () =>
        setContentState((p) => ({
          ...p,
          offline: true,
          fallback: false,
        })),
    },
    {
      label: "Memory limit modal",
      fn: () => {
        contentStateRef.current?.openModal?.(
          chrome.i18n.getMessage("memoryLimitTitle"),
          chrome.i18n.getMessage("memoryLimitDescription"),
          chrome.i18n.getMessage("understoodButton"),
          null,
          () => {},
          () => {}
        );
      },
    },
    {
      label: "Having issues modal",
      fn: () => {
        contentStateRef.current?.openModal?.(
          chrome.i18n.getMessage("havingIssuesModalTitle"),
          chrome.i18n.getMessage("havingIssuesModalDescription"),
          chrome.i18n.getMessage("restoreRecording"),
          chrome.i18n.getMessage("havingIssuesModalButton2"),
          () => {},
          () => {}
        );
      },
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 6,
        right: 6,
        zIndex: Z,
        background: "rgba(20,20,20,0.9)",
        borderRadius: "6px",
        padding: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        fontFamily: "monospace",
        maxWidth: "160px",
        maxHeight: "90vh",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2px",
        }}
      >
        <span style={{ color: "#0f0", fontSize: "10px" }}>DEV HUD</span>
        <span
          onClick={() => setCollapsed(true)}
          style={{ color: "#888", fontSize: "12px", cursor: "pointer" }}
        >
          x
        </span>
      </div>
      {actions.map((a) => (
        <button key={a.label} style={BTN} onClick={a.fn}>
          {a.label}
        </button>
      ))}
      <button
        style={BTN_RESET}
        onClick={() =>
          setContentState((p) => ({
            ...p,
            ready: true,
            fallback: false,
            noffmpeg: false,
            editErrorType: null,
            isFfmpegRunning: false,
            mp4ready: true,
            offline: false,
            processingProgress: 0,
          }))
        }
      >
        Reset
      </button>
    </div>
  );
};

export default DevHUD;
