import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { useEffect } from "react";

import fixWebmDuration from "fix-webm-duration";
import { default as fixWebmDurationFallback } from "webm-duration-fix";

import localforage from "localforage";
import DevHUD from "../DevHUD";
import {
  formatLocalTimestamp,
  getHostnameFromUrl,
  sanitizeFilenameBase,
} from "../../utils/filenameHelpers";
import {
  debugRecordingEventWithSession,
  isRecordingDebugEnabled,
} from "../../utils/recordingDebug";
import { diagForward } from "../../utils/diagForward";
import { perfMark, perfSpan } from "../../utils/perfMarks";
import { triggerSupportDownload } from "../../utils/triggerSupportDownload";
import { chooseReader } from "../recorderStorage/chooseReader";
import {
  Input,
  Output,
  BlobSource,
  BufferTarget,
  Mp4OutputFormat,
  ALL_FORMATS,
  Conversion,
} from "mediabunny";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity", // global DB group
  version: 1,
});

const chunksStore = localforage.createInstance({
  name: "chunks", // the actual DB name
  storeName: "keyvaluepairs",
});

export const ContentStateContext = createContext();

const DEBUG_RECORDER =
  typeof window !== "undefined" ? !!window.SCREENITY_DEBUG_RECORDER : false;
const DEBUG_POSTSTOP = DEBUG_RECORDER;

const ContentState = (props) => {
  const videoChunks = useRef([]);
  const makeVideoCheck = useRef(false);
  const chunkCount = useRef(0);
  const recdbgSessionRef = useRef(null);
  const tabIdRef = useRef(null);
  const opIdRef = useRef(0);
  const editWatchdogRef = useRef(null);

  useEffect(() => {
    if (!DEBUG_RECORDER && !isRecordingDebugEnabled()) return;
    chrome.storage.local.get(
      ["recordingDebugSessionId", "recordingDebugStartMs"],
      (res) => {
        if (!res?.recordingDebugSessionId) return;
        recdbgSessionRef.current = {
          sessionId: res.recordingDebugSessionId,
          startTimeMs: res.recordingDebugStartMs || null,
          startPerfMs: null,
        };
      },
    );
  }, []);

  useEffect(() => {
    try {
      chrome.tabs.getCurrent((tab) => {
        tabIdRef.current = tab?.id || null;
      });
    } catch {}
  }, []);

  useEffect(() => {
    diagMountAtRef.current = Date.now();
    try {
      chrome.tabs.getCurrent((tab) => {
        diagForward("sandbox-open", {
          tabId: tab?.id ?? null,
          timestamp: diagMountAtRef.current,
        });
      });
    } catch {
      diagForward("sandbox-open", {
        tabId: null,
        timestamp: diagMountAtRef.current,
      });
    }

    const MAX_HEARTBEATS = 6;
    const HEARTBEAT_MS = 30000;
    const interval = setInterval(() => {
      const s = contentStateRef.current;
      if (s?.ready) {
        clearInterval(interval);
        return;
      }
      if (diagHeartbeatCountRef.current >= MAX_HEARTBEATS) {
        clearInterval(interval);
        return;
      }
      diagHeartbeatCountRef.current += 1;
      diagForward("sandbox-stuck-heartbeat", {
        chunkCount: s?.chunkCount ?? 0,
        chunkIndex: s?.chunkIndex ?? 0,
        hasRawBlob: Boolean(s?.rawBlob),
        hasBlob: Boolean(s?.blob),
        secondsSinceMount: Math.round(
          (Date.now() - (diagMountAtRef.current || Date.now())) / 1000,
        ),
      });
    }, HEARTBEAT_MS);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!DEBUG_RECORDER && !isRecordingDebugEnabled()) return;
    window.__screenityExportRecordingDebug = async () => {
      const { recordingDebugSessionId } = await chrome.storage.local.get([
        "recordingDebugSessionId",
      ]);
      if (!recordingDebugSessionId) {
        // eslint-disable-next-line no-console
        console.warn("[Sandbox] No recording debug session id found.");
        return;
      }
      chrome.runtime.sendMessage({
        type: "export-recording-debug",
        sessionId: recordingDebugSessionId,
      });
    };
    window.__screenityPingRecdbg = () =>
      chrome.runtime.sendMessage({ type: "recdbg-ping" });
  }, []);

  // legacy ffmpeg editor loads entire blob into WASM (~3x peak RAM); cap edit length
  const isLegacyFfmpegEditor =
    typeof window !== "undefined" &&
    typeof window.location !== "undefined" &&
    /\/editor\.html(?:[?#]|$)/.test(window.location.pathname + window.location.search);
  const MAX_EDIT_LIMIT_S = isLegacyFfmpegEditor ? 600 : 3600;

  const defaultState = {
    time: 0,
    editLimit: 420,
    playerLoading: false,
    finalizingRecording: false,
    lastDownloadInfo: null,
    lastRecordingBackend: null,
    blob: null,
    webm: null,
    originalBlob: null,
    updatePlayerTime: false,
    start: 0, // Add missing properties here
    end: 1,
    trimming: false,
    cutting: false,
    muting: false,
    editErrorType: null, // null | "too-long" | "timeout" | "failed" | "audio-too-large"
    history: [{}], // Initialize history with a default state
    redoHistory: [],
    undoDisabled: true,
    redoDisabled: true,
    duration: 0,
    mode: "player",
    ffmpegLoaded: false,
    frame: null,
    pendingCropEntry: false,
    getFrame: null,
    openToast: null,
    isFfmpegRunning: false,
    reencoding: false,
    prevWidth: 0,
    width: 0,
    prevHeight: 0,
    height: 0,
    top: 0,
    left: 0,
    fromCropper: false,
    base64: null,
    saveDrive: false,
    downloading: false,
    downloadingWEBM: false,
    downloadingGIF: false,
    volume: 1,
    cropPreset: "none",
    replaceAudio: false,
    title: null,
    ready: false,
    mp4ready: false,
    saved: false,
    iframeRef: null,
    offline: false,
    updateChrome: false,
    driveEnabled: false,
    hasBeenEdited: false,
    dragInteracted: false,
    noffmpeg: false,
    processingProgress: 0, // Progress percentage (0-100) for current operation
    openModal: null,
    rawBlob: null,
    override: false,
    fallback: false,
    chunkCount: 0,
    chunkIndex: 0,
    bannerSupport: false,
    backupBlob: null,
    recordingMeta: null,
  };

  const [contentState, _setContentState] = useState(defaultState);
  const contentStateRef = useRef(contentState);
  const launchModeRef = useRef("normal");
  const launchRecordingIdRef = useRef(null);
  const pseudoProgressTimerRef = useRef(null);
  const pseudoProgressStartRef = useRef(null);
  const pseudoProgressStartAtRef = useRef(null);
  const diagMountAtRef = useRef(null);
  const diagMakeVideoAtRef = useRef(null);
  const editorReadyDiagSentRef = useRef(false);
  const editorErrorShownRef = useRef(false);
  const diagHeartbeatCountRef = useRef(0);

  const setContentState = useCallback((updater) => {
    _setContentState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      contentStateRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      launchModeRef.current = params.get("mode") || "normal";
      launchRecordingIdRef.current = params.get("recordingId") || null;
    } catch {}
  }, []);

  useEffect(() => {
    // emit diag-editor-ready once; WebM has many "ready:true" branches
    if (!contentState.ready) return;
    if (editorReadyDiagSentRef.current) return;
    editorReadyDiagSentRef.current = true;
    const blobType = contentStateRef.current?.blob?.type
      || contentStateRef.current?.rawBlob?.type
      || null;
    const path = blobType?.includes("mp4") ? "mp4-fast" : "webm";
    chrome.runtime
      .sendMessage({ type: "diag-editor-ready", path })
      .catch(() => {});
    // Mirror to storage so BG's deferred endDiagSession watcher can see
    // ready without depending on the diag session being open.
    try {
      chrome.storage.local.set({
        editorReadyAt: Date.now(),
        editorReadyPath: path,
      });
    } catch {}
  }, [contentState.ready]);

  useEffect(() => {
    if (launchModeRef.current !== "postStop") return;
    if (contentState.ready) {
      if (pseudoProgressTimerRef.current) {
        clearInterval(pseudoProgressTimerRef.current);
        pseudoProgressTimerRef.current = null;
      }
      return;
    }

    if (pseudoProgressTimerRef.current || pseudoProgressStartRef.current)
      return;
    pseudoProgressStartRef.current = setTimeout(() => {
      pseudoProgressStartRef.current = null;
      if (contentStateRef.current?.ready) return;
      if ((contentStateRef.current?.processingProgress || 0) > 0) return;
      pseudoProgressStartAtRef.current = Date.now();
      pseudoProgressTimerRef.current = setInterval(() => {
        setContentState((prev) => {
          if (prev.ready) return prev;
          const current = Number(prev.processingProgress || 0);
          const elapsedMs = Math.max(
            0,
            Date.now() - (pseudoProgressStartAtRef.current || Date.now()),
          );
          const target = Math.min(90, Math.round((elapsedMs / 6000) * 90));
          const next = Math.max(current, target);
          if (next <= current) return prev;
          return { ...prev, processingProgress: next };
        });
      }, 200);
    }, 800);

    return () => {
      if (pseudoProgressStartRef.current) {
        clearTimeout(pseudoProgressStartRef.current);
        pseudoProgressStartRef.current = null;
      }
      pseudoProgressStartAtRef.current = null;
      if (pseudoProgressTimerRef.current) {
        clearInterval(pseudoProgressTimerRef.current);
        pseudoProgressTimerRef.current = null;
      }
    };
  }, [contentState.ready]);

  const waitForFinalizeReady = async (recordingId) => {
    if (!recordingId) return { ok: true };
    const key = `freeFinalizeStatus:${recordingId}`;
    const timeoutMs = 60_000;
    const pollMs = 200;
    const start = Date.now();
    debugRecordingEventWithSession(recdbgSessionRef.current, "poststop-wait", {
      recordingId,
      key,
      timeoutMs,
      pollMs,
    });

    const getStatus = async () => {
      const res = await chrome.storage.local.get([key]);
      return res[key] || null;
    };

    return new Promise(async (resolve) => {
      let done = false;
      const cleanup = () => {
        done = true;
        chrome.storage.onChanged.removeListener(onChanged);
        clearInterval(pollTimer);
      };

      const handleStatus = (status) => {
        if (!status || done) return;
        if (DEBUG_POSTSTOP)
          console.debug("[Screenity][Sandbox] waitForFinalizeReady status", {
            status,
          });
        const rawPct = typeof status.percent === "number" ? status.percent : 0;
        const prePct = Math.min(90, Math.max(0, Math.round(rawPct * 0.9)));
        debugRecordingEventWithSession(
          recdbgSessionRef.current,
          "poststop-status",
          {
            recordingId,
            stage: status.stage,
            percent: status.percent,
            updatedAt: status.updatedAt,
          },
        );
        setContentState((prev) => ({
          ...prev,
          isFfmpegRunning: true,
          processingProgress: Math.max(prev.processingProgress || 0, prePct),
        }));
        if (status.stage === "chunks_ready" || status.stage === "ready") {
          cleanup();
          debugRecordingEventWithSession(
            recdbgSessionRef.current,
            "poststop-ready",
            { recordingId, stage: status.stage },
          );
          resolve({ ok: true });
        } else if (status.stage === "failed") {
          cleanup();
          debugRecordingEventWithSession(
            recdbgSessionRef.current,
            "poststop-failed",
            { recordingId, error: status.error || "failed" },
          );
          resolve({ ok: false, error: status.error || "failed" });
        }
      };

      const onChanged = (changes, area) => {
        if (area !== "local") return;
        if (!changes[key]) return;
        handleStatus(changes[key].newValue);
      };

      chrome.storage.onChanged.addListener(onChanged);

      const pollTimer = setInterval(async () => {
        if (done) return;
        if (Date.now() - start > timeoutMs) {
          cleanup();
          debugRecordingEventWithSession(
            recdbgSessionRef.current,
            "poststop-timeout",
            { recordingId, timeoutMs },
          );
          resolve({ ok: false, error: "timeout" });
          return;
        }
        const status = await getStatus();
        handleStatus(status);
      }, pollMs);

      const initial = await getStatus();
      handleStatus(initial);
    });
  };

  useEffect(() => {
    if (launchModeRef.current !== "postStop") return;
    if (!contentState.chunkCount) return;
    const ratio =
      contentState.chunkCount > 0
        ? contentState.chunkIndex / contentState.chunkCount
        : 0;
    const pct = Math.min(100, Math.max(20, Math.round(ratio * 80 + 20)));
    setContentState((prev) => ({
      ...prev,
      processingProgress: pct,
    }));
  }, [contentState.chunkIndex, contentState.chunkCount]);

  const buildBlobFromChunks = async () => {
    const { lastRecordingBackendRef } = await chrome.storage.local.get([
      "lastRecordingBackendRef",
    ]);
    const reader = chooseReader(lastRecordingBackendRef);
    await reader.open(lastRecordingBackendRef);
    let readResult;
    try {
      readResult = await reader.readBlob();
    } finally {
      await reader.close().catch(() => {});
    }
    if (!readResult || readResult.chunkCount === 0) {
      debug("No chunks found in chunk reader");
      if (DEBUG_POSTSTOP)
        console.warn(
          "[Screenity][Sandbox] buildBlobFromChunks: no parts found",
        );
      debugRecordingEventWithSession(recdbgSessionRef.current, "blob-empty", {
        chunkCount: 0,
      });
      return null;
    }
    const blob = readResult.blob;
    if (DEBUG_POSTSTOP)
      console.debug(
        "[Screenity][Sandbox] buildBlobFromChunks: reconstructed blob",
        {
          size: blob.size,
          type: blob.type,
          chunkCount: readResult.chunkCount,
        },
      );
    reconstructVideo(blob);
    return blob;
  };

  useEffect(() => {
    const loadInitialTitle = async () => {
      const date = new Date();
      const formattedDate = date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const fallbackTitle = `Screenity video - ${formattedDate}`;

      try {
        const { recordingMeta } = await chrome.storage.local.get([
          "recordingMeta",
        ]);
        if (recordingMeta?.type === "tab") {
          const baseTitle = sanitizeFilenameBase(
            recordingMeta.title?.trim() ||
              getHostnameFromUrl(recordingMeta.url) ||
              fallbackTitle,
          );
          const timestamp = formatLocalTimestamp(recordingMeta.startedAt);
          setContentState((prevState) => ({
            ...prevState,
            title: `${baseTitle} — ${timestamp}`,
            recordingMeta,
          }));
          chrome.storage.local.remove(["recordingMeta"]);
          return;
        }
      } catch (error) {
        console.warn("Failed to load recording meta:", error);
      }

      setContentState((prevState) => ({
        ...prevState,
        title: fallbackTitle,
        recordingMeta: null,
      }));
    };

    loadInitialTitle();
  }, []);

  useEffect(() => {
    if (!contentState.saved) {
      window.onbeforeunload = function () {
        return true;
      };
    } else {
      window.onbeforeunload = null;
    }
  }, [contentState.saved]);

  const createBackup = () => {
    setContentState((prev) => ({
      ...prev,
      backupBlob: prev.blob,
    }));
  };

  const restoreBackup = () => {
    setContentState((prev) => ({
      ...prev,
      blob: prev.backupBlob || prev.blob,
      mode: "player",
      start: 0,
      end: 1,
      backupBlob: null,
    }));
  };

  const clearBackup = () => {
    setContentState((prev) => ({
      ...prev,
      backupBlob: null,
    }));
  };

  // each entry pins a blob (multi-GB on long recordings); cap to bound memory
  const MAX_HISTORY_DEPTH = 20;
  const addToHistory = useCallback(() => {
    setContentState((prevState) => {
      const next = [...prevState.history, prevState];
      if (next.length > MAX_HISTORY_DEPTH) {
        next.splice(0, next.length - MAX_HISTORY_DEPTH);
      }
      return {
        ...prevState,
        history: next,
        redoHistory: [],
      };
    });
  }, [contentState]);

  // History snapshots taken mid-edit can carry isFfmpegRunning:true and
  // edit-mode flags. Restoring such a snapshot leaves redo greyed out and
  // edit buttons disabled. The action gate already confirms no FFmpeg
  // is in flight by the time undo/redo can fire, so reset on every restore.
  const RESET_RUNTIME_FLAGS = {
    isFfmpegRunning: false,
    trimming: false,
    cutting: false,
    muting: false,
    cropping: false,
    reencoding: false,
  };

  const undo = useCallback(() => {
    if (contentState.history.length > 1) {
      const previousState =
        contentState.history[contentState.history.length - 2];
      const newHistory = contentState.history.slice(0, -1);
      setContentState((prevState) => ({
        ...prevState,
        ...previousState,
        history: newHistory,
        redoHistory: [contentState, ...contentState.redoHistory],
        ...RESET_RUNTIME_FLAGS,
      }));
    }
  }, [contentState]);

  const redo = useCallback(() => {
    if (contentState.redoHistory.length > 0) {
      const nextState = contentState.redoHistory[0];
      const newRedoHistory = contentState.redoHistory.slice(1);
      setContentState((prevState) => ({
        ...prevState,
        ...nextState,
        history: [...contentState.history, contentState],
        redoHistory: newRedoHistory,
        ...RESET_RUNTIME_FLAGS,
      }));
    }
  }, [contentState]);

  const base64ToUint8Array = (base64) => {
    const dataUrlRegex = /^data:(.*?);base64,/;
    const matches = base64.match(dataUrlRegex);
    if (matches !== null) {
      // Base64 is a data URL
      const mimeType = matches[1];
      const binaryString = atob(base64.slice(matches[0].length));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    } else {
      // Base64 is a regular string
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  };

  useEffect(() => {
    if (!contentState.blob) return;

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = async () => {
      // fragmented MP4 mvhd can be wrong; cross-check storage but only on original
      // (edited blobs are shorter than recordingDuration)
      const isOriginalBlob =
        !contentState.originalBlob ||
        contentState.blob === contentState.originalBlob;
      let durationSec = video.duration;
      if (isOriginalBlob) {
        try {
          const { recordingDuration } = await chrome.storage.local.get([
            "recordingDuration",
          ]);
          const recSec = Number(recordingDuration) > 0
            ? Number(recordingDuration) / 1000
            : 0;
          const probedSec = Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : 0;
          if (recSec > probedSec + 0.3) {
            durationSec = recSec;
          } else if (probedSec > 0) {
            durationSec = probedSec;
          } else if (recSec > 0) {
            durationSec = recSec;
          }
        } catch {}
      }
      setContentState((prevState) => ({
        ...prevState,
        duration: durationSec,
        width: video.videoWidth,
        height: video.videoHeight,
        prevWidth: video.videoWidth,
        prevHeight: video.videoHeight,
      }));

      URL.revokeObjectURL(video.src);
      video.remove();
    };
    video.src = URL.createObjectURL(contentState.blob);
  }, [contentState.blob]);

  const reconstructVideo = async (withBlob) => {
    // sniff magic bytes; WebCodecs chunks are MP4 not WebM.
    // base64ToUint8Array returns Blob for data-URL, Uint8Array for raw
    let inferredType = "video/webm; codecs=vp8,opus";
    if (!withBlob && videoChunks.current.length > 0) {
      try {
        const head = videoChunks.current[0];
        const headLen = head?.length ?? head?.size ?? 0;
        if (head && headLen >= 8) {
          let magic = "";
          const slice = head.slice(4, 8);
          if (slice instanceof Blob) {
            magic = await slice.text();
          } else if (slice instanceof Uint8Array) {
            magic = new TextDecoder().decode(slice);
          }
          if (magic === "ftyp") {
            inferredType = "video/mp4";
          }
          if (DEBUG_RECORDER)
            console.log("[Screenity][Sandbox] reconstructVideo inferred type", {
              magic,
              inferredType,
              chunkCount: videoChunks.current.length,
              totalSize: videoChunks.current.reduce((s, c) => s + c.length, 0),
            });
        }
      } catch (e) {
        console.warn("[Screenity][Sandbox] reconstructVideo type sniff failed", e);
      }
    }

    const reconstructStartedAt = Date.now();
    const totalBytesIn = withBlob
      ? withBlob.size || 0
      : videoChunks.current.reduce((s, c) => s + (c?.length || 0), 0);
    diagForward("sandbox-reconstruct-start", {
      chunkIndex: contentStateRef.current?.chunkIndex ?? 0,
      chunkCount: contentStateRef.current?.chunkCount ?? 0,
      totalBytes: totalBytesIn,
      withBlob: Boolean(withBlob),
    });

    let blob;
    try {
      if (withBlob) {
        blob = withBlob;
      } else {
        // trim at first gap; sparse holes from out-of-order arrivals corrupt video
        let firstGap = -1;
        for (let i = 0; i < videoChunks.current.length; i += 1) {
          if (videoChunks.current[i] == null) {
            firstGap = i;
            break;
          }
        }
        const safeChunks =
          firstGap >= 0
            ? videoChunks.current.slice(0, firstGap)
            : videoChunks.current;
        if (firstGap >= 0) {
          diagForward("sandbox-reconstruct-trimmed-at-gap", {
            firstGap,
            haveCount: safeChunks.length,
            totalSlots: videoChunks.current.length,
          });
        }
        blob = new Blob(safeChunks, { type: inferredType });
      }
      perfMark("Sandbox blob-built", {
        bytes: blob?.size ?? 0,
        chunks: videoChunks.current.length,
      });
    } catch (err) {
      diagForward("sandbox-reconstruct-error", {
        error: String(err?.message || err).slice(0, 200),
        phase: "blob",
        chunkIndex: contentStateRef.current?.chunkIndex ?? 0,
        totalBytes: totalBytesIn,
      });
      throw err;
    }
    diagForward("sandbox-reconstruct-done", {
      blobBytes: blob?.size ?? 0,
      elapsedMs: Date.now() - reconstructStartedAt,
      type: blob?.type || null,
    });
    let isFastWebm = false;
    if (blob.type === "video/webm") {
      try {
        const { lastRecordingBackendRef } = await chrome.storage.local.get([
          "lastRecordingBackendRef",
        ]);
        isFastWebm =
          lastRecordingBackendRef?.backend === "opfs" &&
          /\.webm$/i.test(lastRecordingBackendRef?.fileName || "");
      } catch {}
    }
    if (blob.type === "video/mp4" || isFastWebm) {
      if (DEBUG_RECORDER)
        console.log("[Screenity][Sandbox] reconstructVideo: fast path taken", {
          size: blob.size,
          type: blob.type,
          isFastWebm,
        });
      setContentState((prev) => ({
        ...prev,
        blob: blob,
        webm: isFastWebm ? blob : null,
        mp4ready: true,
        ready: true,
        rawBlob: blob,
        originalBlob: prev.originalBlob || blob,
        isFfmpegRunning: false,
        noffmpeg: false,
        editLimit: Math.max(prev.editLimit || 0, MAX_EDIT_LIMIT_S),
      }));

      const video = document.createElement("video");
      video.preload = "metadata";
      const videoLoadStart = Date.now();
      video.onloadedmetadata = () => {
        perfMark("Sandbox video-loadedmetadata", {
          duration: video.duration,
          w: video.videoWidth,
          h: video.videoHeight,
        });
        diagForward("sandbox-video-loadedmetadata", {
          elapsedMs: Date.now() - videoLoadStart,
          duration: Number.isFinite(video.duration) ? video.duration : null,
          width: video.videoWidth,
          height: video.videoHeight,
          blobBytes: blob?.size ?? 0,
        });
        setContentState((prev) => ({
          ...prev,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        }));

        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => {
        const errCode = video.error?.code ?? null;
        const errMessage = video.error?.message ?? null;
        diagForward("sandbox-video-load-error", {
          elapsedMs: Date.now() - videoLoadStart,
          code: errCode,
          message: errMessage ? String(errMessage).slice(0, 200) : null,
          blobBytes: blob?.size ?? 0,
        });
        diagForward("sandbox-reconstruct-error", {
          error: "video-element-error",
          phase: "video-load",
          chunkIndex: contentStateRef.current?.chunkIndex ?? 0,
          totalBytes: blob?.size ?? 0,
        });
      };
      try {
        video.src = URL.createObjectURL(blob);
        diagForward("sandbox-video-src-set", {
          blobBytes: blob?.size ?? 0,
        });
      } catch (err) {
        diagForward("sandbox-reconstruct-error", {
          error: String(err?.message || err).slice(0, 200),
          phase: "url",
          chunkIndex: contentStateRef.current?.chunkIndex ?? 0,
          totalBytes: blob?.size ?? 0,
        });
      }

      chrome.runtime.sendMessage({ type: "recording-complete" });
      chrome.runtime.sendMessage({ type: "diag-editor-ready", path: "mp4-fast" }).catch(() => {});
      return;
    }

    let { recordingDuration } = await chrome.storage.local.get(
      "recordingDuration",
    );

    // If recordingDuration is missing or 0, try to probe it from the blob
    if (!recordingDuration || recordingDuration <= 0) {
      console.warn(
        "[Screenity][WebM] recordingDuration missing or 0, probing from blob",
      );
      try {
        const probeDuration = await new Promise((resolve) => {
          const probe = document.createElement("video");
          probe.preload = "metadata";
          const timeout = setTimeout(() => {
            URL.revokeObjectURL(probe.src);
            resolve(0);
          }, 5000);
          probe.onloadedmetadata = () => {
            clearTimeout(timeout);
            const dur = probe.duration;
            URL.revokeObjectURL(probe.src);
            if (Number.isFinite(dur) && dur > 0) {
              resolve(Math.round(dur * 1000));
            } else {
              resolve(0);
            }
          };
          probe.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(probe.src);
            resolve(0);
          };
          probe.src = URL.createObjectURL(blob);
        });
        if (probeDuration > 0) {
          recordingDuration = probeDuration;
        }
      } catch (err) {
        console.warn("[Screenity][WebM] blob duration probe failed:", err);
      }
    }

    const { token } = await chrome.storage.local.get("token");

    let driveEnabled = false;

    if (token && token !== null) {
      driveEnabled = true;
    }

    const safeDuration = Number(recordingDuration) || 0;
    setContentState((prevState) => ({
      ...prevState,
      rawBlob: blob,
      duration: safeDuration / 1000,
    }));

    const isWindows10 = navigator.userAgent.match(/Windows NT 10.0/);

    try {
      if (safeDuration > 0) {
        if (!isWindows10) {
          fixWebmDuration(
            blob,
            safeDuration,
            async (fixedWebm) => {
              if (
                contentStateRef.current.updateChrome ||
                contentStateRef.current.noffmpeg ||
                (contentStateRef.current.duration >
                  contentStateRef.current.editLimit &&
                  !contentStateRef.current.override)
              ) {
                setContentState((prevState) => ({
                  ...prevState,
                  webm: fixedWebm,
                  ready: true,
                  isFfmpegRunning: false,
                }));
                chrome.runtime.sendMessage({ type: "recording-complete" });
                return;
              }

              const reader = new FileReader();
              reader.onloadend = function () {
                const base64data = reader.result;
                setContentState((prevContentState) => ({
                  ...prevContentState,
                  base64: base64data,
                  driveEnabled: driveEnabled,
                }));
              };
              reader.readAsDataURL(fixedWebm);
            },
            { logger: false },
          );
        } else {
          const fixedWebm = await fixWebmDurationFallback(blob, {
            type: "video/webm; codecs=vp8, opus",
          });
          if (
            contentStateRef.current.updateChrome ||
            contentStateRef.current.noffmpeg ||
            (contentStateRef.current.duration >
              contentStateRef.current.editLimit &&
              !contentStateRef.current.override)
          ) {
            setContentState((prevState) => ({
              ...prevState,
              webm: fixedWebm,
              ready: true,
              isFfmpegRunning: false,
            }));
            chrome.runtime.sendMessage({ type: "recording-complete" });
            return;
          }

          const reader = new FileReader();
          reader.onloadend = function () {
            const base64data = reader.result;
            setContentState((prevContentState) => ({
              ...prevContentState,
              base64: base64data,
              driveEnabled: driveEnabled,
            }));
          };
          reader.readAsDataURL(fixedWebm);
        }
      } else {
        console.warn(
          "[Screenity][WebM] skipping duration fix: safeDuration=0, blob will have broken seek metadata",
        );
        if (
          contentStateRef.current.updateChrome ||
          contentStateRef.current.noffmpeg ||
          (contentStateRef.current.duration >
            contentStateRef.current.editLimit &&
            !contentStateRef.current.override)
        ) {
          setContentState((prevState) => ({
            ...prevState,
            webm: blob,
            ready: true,
            isFfmpegRunning: false,
          }));
          chrome.runtime.sendMessage({ type: "recording-complete" });
          return;
        }

        const reader = new FileReader();
        reader.onloadend = function () {
          const base64data = reader.result;
          setContentState((prevContentState) => ({
            ...prevContentState,
            base64: base64data,
            driveEnabled: driveEnabled,
          }));
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error(
        "[Screenity][WebM] duration fix failed, using unfixed blob:",
        error,
      );
      setContentState((prevState) => ({
        ...prevState,
        webm: blob,
        ready: true,
        isFfmpegRunning: false,
      }));
      chrome.runtime.sendMessage({ type: "recording-complete" });
    }

    // 45s safety timeout for direct-blob path; fixWebmDuration/readAsDataURL can hang
    if (withBlob) {
      setTimeout(() => {
        const s = contentStateRef.current;
        if (s?.ready) return;
        console.warn(
          "[Screenity][WebM] reconstructVideo(blob) safety timeout: forcing ready with raw blob",
        );
        setContentState((prev) => {
          if (prev.ready) return prev;
          return {
            ...prev,
            webm: prev.webm || prev.rawBlob || withBlob,
            ready: true,
            noffmpeg: true,
            isFfmpegRunning: false,
          };
        });
        chrome.runtime.sendMessage({ type: "recording-complete" });
      }, 45000);
    }
  };

  const checkMemory = () => {
    if (typeof contentStateRef.current.openModal === "function") {
      chrome.storage.local.get("memoryError", (result) => {
        if (result.memoryError && result.memoryError !== null) {
          chrome.storage.local.set({ memoryError: false });
          contentStateRef.current.openModal(
            chrome.i18n.getMessage("memoryLimitTitle"),
            chrome.i18n.getMessage("memoryLimitDescription"),
            chrome.i18n.getMessage("understoodButton"),
            null,
            () => {},
            () => {},
            null,
            chrome.i18n.getMessage("learnMoreDot"),
            () => {
              chrome.runtime.sendMessage({ type: "memory-limit-help" });
            },
            false, // colorSafe
            chrome.i18n.getMessage("getHelpButton"),
            () => {
              triggerSupportDownload({ source: "memory-limit" });
              chrome.runtime.sendMessage({
                type: "report-error",
                errorCode: "REC_RUN_MEMORY",
                source: "memory-limit",
                zipBundled: true,
              });
            },
          );
        }
      });
    }
  };

  useEffect(() => {
    chunkCount.current = contentState.chunkCount;
  }, [contentState.chunkCount]);

  const handleBatch = (chunks, sendResponse) => {
    if (videoChunks.current.length === 0) {
      perfMark("Sandbox first-chunk-batch", { batchLen: chunks?.length });
    }
    if (DEBUG_POSTSTOP)
      console.debug("[Screenity][Sandbox] handleBatch called", {
        chunksLen: chunks?.length,
      });
    // Process chunks asynchronously, but do not make this function async
    (async () => {
      try {
        await Promise.all(
          chunks.map(async (chunk) => {
            const chunkData = base64ToUint8Array(chunk.chunk);
            // Place at declared index instead of pushing in arrival order.
            // Makes reassembly correct even when:
            //   - Messages arrive out of order (concurrent BG sendChunks)
            //   - The same chunk is delivered twice (idempotent: same slot,
            //     same content)
            //   - Batches interleave across multiple BG senders
            const idx =
              typeof chunk.index === "number" && chunk.index >= 0
                ? chunk.index
                : videoChunks.current.length;
            const alreadyFilled = videoChunks.current[idx] != null;
            if (DEBUG_POSTSTOP)
              console.debug("[Screenity][Sandbox] handleBatch slot", {
                index: idx,
                size: chunkData?.size || chunkData?.length || null,
                duplicate: alreadyFilled,
              });
            videoChunks.current[idx] = chunkData;
            if (!alreadyFilled) {
              // Only count new slots toward progress; duplicates don't advance.
              setContentState((prevState) => ({
                ...prevState,
                chunkIndex: prevState.chunkIndex + 1,
              }));
            }
          }),
        );

        sendResponse({ status: "ok" });
      } catch (err) {
        console.error("Error processing batch", err);
        try {
          sendResponse?.({
            status: "error",
            error: String(err?.message || err),
          });
        } catch {}
      }
    })();

    return true;
  };

  useEffect(() => {
    const version = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);

    const MIN_CHROME_VERSION = 109;

    if (version && parseInt(version[2], 10) < MIN_CHROME_VERSION) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        updateChrome: true,
        noffmpeg: true,
      }));
    }
  }, []);

  const makeVideoTab = async (sendResponse = null, message) => {
    if (makeVideoCheck.current) return;
    makeVideoCheck.current = true;
    perfMark("Sandbox makeVideoTab.enter", { override: message?.override });
    if (DEBUG_POSTSTOP)
      console.debug("[Screenity][Sandbox] makeVideoTab invoked", {
        override: message?.override,
      });
    setContentState((prevState) => ({
      ...prevState,
      override: message.override,
    }));
    // clear leftover memoryError without surfacing modal; recording-time toast already fired
    try {
      chrome.storage.local.set({ memoryError: false });
    } catch {}
    let directBlob = null;
    let opfsReadFailed = false;
    let backendRefForThisLoad = null;
    try {
      const { lastRecordingBackendRef } = await chrome.storage.local.get([
        "lastRecordingBackendRef",
      ]);
      backendRefForThisLoad = lastRecordingBackendRef;
      if (process.env.SCREENITY_DEV_MODE === "true") {
        console.log(
          "[recorder-opfs][sandbox] makeVideoTab backend",
          lastRecordingBackendRef || { backend: "idb" },
        );
      }
      setContentState((prev) => ({
        ...prev,
        lastRecordingBackend: lastRecordingBackendRef?.backend || "idb",
      }));
      if (lastRecordingBackendRef?.backend === "opfs") {
        const reader = chooseReader(lastRecordingBackendRef);
        const readerOpenStart = Date.now();
        await reader.open(lastRecordingBackendRef);
        diagForward("sandbox-opfs-reader-open-done", {
          elapsedMs: Date.now() - readerOpenStart,
          fileName: lastRecordingBackendRef?.fileName || null,
        });
        const readBlobStart = Date.now();
        diagForward("sandbox-opfs-readblob-start", {});
        const { blob: rawBlob } = await reader.readBlob({
          // OPFS file isn't ready yet, recorder still flushing under load.
          // Surface a labeled loading state so the user knows it's progressing.
          onSlowFinalize: () => {
            diagForward("sandbox-opfs-readblob-slow-finalize", {
              elapsedMs: Date.now() - readBlobStart,
            });
            setContentState((prev) =>
              prev.finalizingRecording ? prev : { ...prev, finalizingRecording: true },
            );
          },
        });
        diagForward("sandbox-opfs-readblob-done", {
          elapsedMs: Date.now() - readBlobStart,
          rawBlobBytes: rawBlob?.size ?? 0,
        });
        setContentState((prev) =>
          prev.finalizingRecording ? { ...prev, finalizingRecording: false } : prev,
        );
        await reader.close().catch(() => {});
        // Use the OPFS-backed Blob on the critical path. The previous
        // arrayBuffer copy was defensive against mtime/deletion but
        // could take 30-60s on slow disks for 100MB+ files (the "stuck
        // at 90%" reports). Materialize in the background instead, so a
        // later recording that deletes the OPFS file doesn't strand the
        // editor.
        const blob = rawBlob;
        if (rawBlob) {
          diagForward("sandbox-opfs-materialize-deferred", {
            bytes: rawBlob.size,
          });
          // Fire-and-forget materialize. Swaps in once done; the video
          // element keeps the original src so playback isn't disrupted.
          if (rawBlob.size <= 1_500_000_000) {
            const materializeStart = Date.now();
            (async () => {
              try {
                const buf = await rawBlob.arrayBuffer();
                const materialized = new Blob([buf], {
                  type: rawBlob.type || "video/mp4",
                });
                diagForward("sandbox-opfs-materialize-done", {
                  elapsedMs: Date.now() - materializeStart,
                  outputBytes: materialized.size,
                });
                setContentState((prev) => ({
                  ...prev,
                  blob: materialized,
                  rawBlob: prev.rawBlob || materialized,
                }));
              } catch (err) {
                diagForward("sandbox-opfs-materialize-fail", {
                  elapsedMs: Date.now() - materializeStart,
                  err: String(err?.message || err).slice(0, 200),
                });
              }
            })();
          }
        }
        if (blob) {
          directBlob = blob;
          diagForward("sandbox-opfs-direct-read", {
            outputBytes: blob.size,
          });
          if (process.env.SCREENITY_DEV_MODE === "true") {
            console.log("[recorder-opfs][sandbox] opfs-direct-read-ok", {
              bytes: blob.size,
            });
          }
        } else {
          opfsReadFailed = true;
        }
      }
    } catch (err) {
      opfsReadFailed = true;
      diagForward("sandbox-opfs-direct-read-fail", {
        err: String(err?.message || err).slice(0, 200),
      });
      console.warn(
        "[Screenity][Sandbox] OPFS direct read failed",
        err,
      );
    }

    if (opfsReadFailed && !directBlob) {
      try {
        const idbReader = chooseReader({ backend: "idb" });
        await idbReader.open({ backend: "idb" });
        const { blob, chunkCount } = await idbReader.readBlob();
        await idbReader.close().catch(() => {});
        if (blob && chunkCount > 0) {
          directBlob = blob;
          if (process.env.SCREENITY_DEV_MODE === "true") {
            console.log(
              "[recorder-opfs][sandbox] OPFS failed but IDB fallback succeeded",
              { bytes: blob.size, chunkCount },
            );
          }
        }
      } catch {}
      if (!directBlob) {
        if (typeof contentStateRef.current?.openModal === "function") {
          contentStateRef.current.openModal(
            chrome.i18n.getMessage("opfsLoadErrorTitle"),
            chrome.i18n.getMessage("opfsLoadErrorDescription"),
            null,
            chrome.i18n.getMessage("permissionsModalDismiss"),
            () => {},
            () => {},
            null,
            null,
            null,
            true,
            chrome.i18n.getMessage("getHelpButton"),
            () => {
              triggerSupportDownload({ source: "opfs-load-failed" });
              chrome.runtime.sendMessage({
                type: "report-error",
                source: "opfs-load-failed",
                errorCode: "OPFS_LOAD_FAILED",
                zipBundled: true,
              });
            },
          );
        }
        diagForward("sandbox-recording-load-failed", {
          backend: backendRefForThisLoad?.backend || "unknown",
        });
      }
    }
    reconstructVideo(directBlob);

    // mark ready if duration-fix hangs; don't overwrite an already-fixed webm
    const safetyCheck = () => {
      const s = contentStateRef.current;
      if (DEBUG_POSTSTOP)
        console.debug("[Screenity][Sandbox] makeVideoTab: safety-check", {
          chunkCount: s?.chunkCount,
          chunkIndex: s?.chunkIndex,
          rawBlob: Boolean(s?.rawBlob),
          webm: Boolean(s?.webm),
          ready: s?.ready,
        });
      diagForward("sandbox-safety-fired", {
        chunkCount: s?.chunkCount ?? 0,
        chunkIndex: s?.chunkIndex ?? 0,
        hasRawBlob: Boolean(s?.rawBlob),
        hasBlob: Boolean(s?.blob),
        hasWebm: Boolean(s?.webm),
        ready: Boolean(s?.ready),
        elapsedSinceMakeVideoMs: diagMakeVideoAtRef.current
          ? Date.now() - diagMakeVideoAtRef.current
          : null,
      });
      if (s?.ready) return;

      const complete = s?.chunkCount > 0 && s?.chunkIndex >= s?.chunkCount;
      if (complete && s?.rawBlob) {
        if (s?.webm) {
          if (DEBUG_RECORDER)
            console.log(
              "[Screenity][WebM] safety timeout: webm already set by fix, marking ready",
            );
          setContentState((prev) => ({
            ...prev,
            ready: true,
            noffmpeg: true,
            isFfmpegRunning: false,
          }));
        } else {
          console.warn(
            "[Screenity][WebM] safety timeout: duration fix did not complete in time, using unfixed rawBlob",
          );
          setContentState((prev) => ({
            ...prev,
            webm: prev.rawBlob,
            ready: true,
            noffmpeg: true,
            isFfmpegRunning: false,
          }));
        }
        chrome.runtime.sendMessage({ type: "recording-complete" });
      }
    };
    setTimeout(() => {
      if (!contentStateRef.current?.ready) {
        safetyCheck();
      }
    }, 30000);
    setTimeout(() => {
      if (!contentStateRef.current?.ready) {
        console.warn(
          "[Screenity][WebM] 60s safety timeout: force-marking ready",
        );
        safetyCheck();
      }
    }, 60000);

    if (sendResponse) sendResponse({ status: "ok" });
  };

  const toBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.onerror = reject;
    });
  };

  const onChromeMessage = useCallback(
    (request, sender, sendResponse) => {
      const message = request;
      if (DEBUG_POSTSTOP)
        console.debug("[Screenity][Sandbox] onChromeMessage", {
          type: message?.type,
          senderTab: sender?.tab?.id,
        });
      if (
        message?._targetTabId &&
        tabIdRef.current &&
        message._targetTabId !== tabIdRef.current
      ) {
        return false;
      }
      if (message.type === "chunk-count") {
        if (DEBUG_POSTSTOP)
          console.debug("[Screenity][Sandbox] received chunk-count", {
            count: message.count,
          });
        diagForward("sandbox-chunk-count-received", {
          count: message?.count ?? 0,
        });
        setContentState((prevState) => ({
          ...prevState,
          chunkCount: message.count,
          override: message.override,
        }));
      } else if (message.type === "ping") {
        sendResponse({ status: "ready" });
      } else if (message.type === "editor-force-close") {
        // BG closes this tab when a new recording starts. the OPFS file
        // backing this editor is about to be deleted, so the unsaved-changes
        // prompt would just block the start flow.
        try {
          window.onbeforeunload = null;
        } catch {}
        sendResponse?.({ ok: true });
      } else if (message.type === "recording-error") {
        // suppress when this editor already loaded; error belongs to a later attempt
        const editorAlreadyLoaded =
          Boolean(contentStateRef.current?.ready) ||
          Boolean(contentStateRef.current?.blob);
        if (editorAlreadyLoaded) return;
        diagForward("sandbox-recording-error-received", {
          error: String(message?.error || "").slice(0, 120),
          why: String(message?.why || "").slice(0, 240),
          errorCode: message?.errorCode || null,
        });
        if (
          !editorErrorShownRef.current &&
          typeof contentStateRef.current?.openModal === "function"
        ) {
          editorErrorShownRef.current = true;
          const errCode = message?.errorCode || "OPFS_LOAD_FAILED";
          contentStateRef.current.openModal(
            chrome.i18n.getMessage("opfsLoadErrorTitle"),
            message?.why || chrome.i18n.getMessage("opfsLoadErrorDescription"),
            null,
            chrome.i18n.getMessage("permissionsModalDismiss"),
            () => {},
            () => {},
            null,
            null,
            null,
            true,
            chrome.i18n.getMessage("getHelpButton"),
            () => {
              triggerSupportDownload({ source: "opfs-load-failed" });
              chrome.runtime.sendMessage({
                type: "report-error",
                source: "opfs-load-failed",
                errorCode: errCode,
                zipBundled: true,
              });
            },
          );
        }
        setContentState((prev) => ({
          ...prev,
          ready: true,
          recordingFailed: true,
        }));
      } else if (message.type === "new-chunk-tab") {
        if (DEBUG_POSTSTOP)
          console.debug("[Screenity][Sandbox] received new-chunk-tab", {
            chunksLen: message?.chunks?.length,
          });
        return handleBatch(message.chunks, sendResponse);
      } else if (message.type === "make-video-tab") {
        if (DEBUG_POSTSTOP)
          console.debug("[Screenity][Sandbox] received make-video-tab");
        diagMakeVideoAtRef.current = Date.now();
        diagForward("sandbox-make-video-tab", null);
        makeVideoTab(sendResponse, message);

        return true;
      } else if (message.type === "saved-to-drive") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          saveDrive: false,
          driveEnabled: true,
          saved: true,
        }));
      } else if (message.type === "restore-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          fallback: true,
          noffmpeg: false, // mediabunny stands in for FFmpeg here
          isFfmpegRunning: false,
          editLimit: MAX_EDIT_LIMIT_S,
        }));

        buildBlobFromChunks()
          .then((blob) => {
            if (!blob) {
              chrome.runtime.sendMessage({ type: "send-chunks-to-sandbox" });
              sendResponse({ status: "deferred" });
              return;
            }
            sendResponse({ status: "ok" });
          })
          .catch((error) => {
            sendResponse({ status: "error", error: error.message });
          });

        return true;
      } else if (message.type === "large-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          noffmpeg: false,
          isFfmpegRunning: true,
          editLimit: 0,
        }));
        const shouldGate =
          launchModeRef.current === "postStop" &&
          Boolean(launchRecordingIdRef.current);
        if (shouldGate) {
          waitForFinalizeReady(launchRecordingIdRef.current).then((result) => {
            if (!result.ok) {
              setContentState((prev) => ({
                ...prev,
                isFfmpegRunning: false,
                noffmpeg: true,
                ffmpegLoaded: true,
                processingProgress: 0,
              }));
              buildBlobFromChunks()
                .then((blob) => {
                  if (!blob) {
                    chrome.runtime.sendMessage({
                      type: "send-chunks-to-sandbox",
                    });
                  }
                })
                .catch(() => {});
              sendResponse({ status: "error", error: result.error });
              return;
            }
            buildBlobFromChunks()
              .then((blob) => {
                if (!blob) {
                  chrome.runtime.sendMessage({
                    type: "send-chunks-to-sandbox",
                  });
                  sendResponse({ status: "deferred" });
                  return;
                }
                sendResponse({ status: "ok" });
              })
              .catch((error) =>
                sendResponse({ status: "error", error: error.message }),
              );
          });
          return true;
        }

        buildBlobFromChunks()
          .then((blob) => {
            if (!blob) {
              chrome.runtime.sendMessage({ type: "send-chunks-to-sandbox" });
              sendResponse({ status: "deferred" });
              return;
            }
            sendResponse({ status: "ok" });
          })
          .catch((error) => {
            sendResponse({ status: "error", error: error.message });
          });

        return true;
      } else if (message.type === "fallback-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          fallback: true,
          noffmpeg: false,
          isFfmpegRunning: true,
          editLimit: MAX_EDIT_LIMIT_S,
        }));
        const shouldGate =
          launchModeRef.current === "postStop" &&
          Boolean(launchRecordingIdRef.current);
        if (shouldGate) {
          waitForFinalizeReady(launchRecordingIdRef.current).then((result) => {
            if (!result.ok) {
              setContentState((prev) => ({
                ...prev,
                isFfmpegRunning: false,
                noffmpeg: true,
                ffmpegLoaded: true,
                processingProgress: 0,
              }));
              buildBlobFromChunks()
                .then((blob) => {
                  if (!blob) {
                    chrome.runtime.sendMessage({
                      type: "send-chunks-to-sandbox",
                    });
                  }
                })
                .catch(() => {});
              sendResponse({ status: "error", error: result.error });
              return;
            }
            buildBlobFromChunks()
              .then((blob) => {
                if (!blob) {
                  chrome.runtime.sendMessage({
                    type: "send-chunks-to-sandbox",
                  });
                  sendResponse({ status: "deferred" });
                  return;
                }
                sendResponse({ status: "ok" });
              })
              .catch((error) =>
                sendResponse({ status: "error", error: error.message }),
              );
          });
          return true;
        }

        buildBlobFromChunks()
          .then((blob) => {
            if (!blob) {
              chrome.runtime.sendMessage({ type: "send-chunks-to-sandbox" });
              sendResponse({ status: "deferred" });
              return;
            }
            sendResponse({ status: "ok" });
          })
          .catch((error) => {
            sendResponse({ status: "error", error: error.message });
          });

        return true;
      } else if (message.type === "viewer-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          fallback: true,
          noffmpeg: true, // No FFmpeg
          isFfmpegRunning: true,
          editLimit: 0, // No editing allowed
        }));
        const shouldGate =
          launchModeRef.current === "postStop" &&
          Boolean(launchRecordingIdRef.current);
        if (shouldGate) {
          waitForFinalizeReady(launchRecordingIdRef.current).then((result) => {
            if (!result.ok) {
              setContentState((prev) => ({
                ...prev,
                isFfmpegRunning: false,
                noffmpeg: true,
                ffmpegLoaded: true,
                processingProgress: 0,
              }));
              buildBlobFromChunks().catch(() => {});
              sendResponse({ status: "error", error: result.error });
              return;
            }
            buildBlobFromChunks()
              .then(() => sendResponse({ status: "ok" }))
              .catch((error) =>
                sendResponse({ status: "error", error: error.message }),
              );
          });
          return true;
        }

        buildBlobFromChunks()
          .then(() => {
            sendResponse({ status: "ok" });
          })
          .catch((error) => {
            sendResponse({ status: "error", error: error.message });
          });

        return true;
      } else if (message.type === "banner-support") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          bannerSupport: true,
        }));
      }
    },
    [
      makeVideoCheck.current,
      videoChunks.current,
      contentState,
      contentStateRef.current,
    ],
  );

  // sandbox self-triggers reconstruct on OPFS; recovery mode is driven by restore-recording
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search || "");
    const isRecoveryMode = params.get("mode") === "recover";
    if (isRecoveryMode) return;

    // 500ms retry in case backendRef hasn't propagated yet
    const attemptSelfTrigger = async (isRetry = false) => {
      try {
        const { lastRecordingBackendRef } = await chrome.storage.local.get([
          "lastRecordingBackendRef",
        ]);
        if (cancelled) return true;
        if (lastRecordingBackendRef?.backend === "opfs") {
          if (process.env.SCREENITY_DEV_MODE === "true") {
            console.log(
              "[recorder-opfs][sandbox] self-trigger makeVideoTab for OPFS backend",
              isRetry ? "(retry)" : "",
            );
          }
          makeVideoTab(null, { override: false });
          return true;
        }
        return false;
      } catch (err) {
        if (process.env.SCREENITY_DEV_MODE === "true") {
          console.warn(
            "[recorder-opfs][sandbox] self-trigger failed",
            err,
          );
        }
        return false;
      }
    };

    (async () => {
      const hit = await attemptSelfTrigger(false);
      if (!hit && !cancelled) {
        setTimeout(() => {
          if (!cancelled) attemptSelfTrigger(true);
        }, 500);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const messageListener = (message, sender, sendResponse) => {
      const shouldKeepPortOpen = onChromeMessage(message, sender, sendResponse);
      return shouldKeepPortOpen === true;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    const storageListener = (changes, areaName) => {
      if (areaName !== "local") return;
      try {
        const tabId = tabIdRef.current;
        // BG writes editorRecordingError; sandboxed context can't use runtime.onMessage
        if (changes.editorRecordingError && changes.editorRecordingError.newValue) {
          const payload = changes.editorRecordingError.newValue;
          // suppress when THIS editor already loaded; error belongs to a later attempt
          const editorAlreadyLoaded =
            Boolean(contentStateRef.current?.ready) ||
            Boolean(contentStateRef.current?.blob);
          if (
            !editorAlreadyLoaded &&
            (tabId == null ||
              payload?.sandboxTab == null ||
              payload.sandboxTab === tabId)
          ) {
            diagForward("sandbox-recording-error-received", {
              error: String(payload?.error || "").slice(0, 120),
              why: String(payload?.why || "").slice(0, 240),
              errorCode: payload?.errorCode || null,
            });
            if (
              !editorErrorShownRef.current &&
              typeof contentStateRef.current?.openModal === "function"
            ) {
              editorErrorShownRef.current = true;
              // prefer i18n over raw codes like "REC_STOP_NO_CHUNKS"
              const rawWhy = payload?.why;
              const whyIsCode =
                typeof rawWhy === "string" && /^[A-Z][A-Z0-9_]+$/.test(rawWhy);
              // pipeline failures get copy that says the recording may still be on-device
              const pipelineFailureCodes = new Set([
                "EDITOR_TAB_LOAD_TIMEOUT",
                "EDITOR_CONTENT_SCRIPT_TIMEOUT",
                "EDITOR_MESSAGE_DELIVERY_FAILED",
              ]);
              const isPipelineFailure = pipelineFailureCodes.has(
                payload?.errorCode,
              );
              const isStuckTimeout =
                payload?.errorCode === "EDITOR_STUCK_TIMEOUT";
              let title;
              let description;
              if (isStuckTimeout) {
                title = chrome.i18n.getMessage("editorStuckTitle");
                description = chrome.i18n.getMessage("editorStuckDescription");
              } else if (isPipelineFailure) {
                title = chrome.i18n.getMessage("editorRecoveryFailedTitle");
                description = chrome.i18n.getMessage(
                  "editorRecoveryFailedDescription",
                );
              } else {
                title = chrome.i18n.getMessage("opfsLoadErrorTitle");
                description =
                  whyIsCode || !rawWhy
                    ? chrome.i18n.getMessage("opfsLoadErrorDescription")
                    : rawWhy;
              }
              contentStateRef.current.openModal(
                title,
                description,
                chrome.i18n.getMessage("editorStuckTryRecover"),
                chrome.i18n.getMessage("permissionsModalDismiss"),
                () => {
                  try {
                    chrome.runtime.sendMessage({ type: "restore-recording" });
                  } catch {}
                },
                () => {},
                null,
                null,
                null,
                false,
                chrome.i18n.getMessage("editorStuckGetHelp"),
                () => {
                  try {
                    triggerSupportDownload({ source: "editor-recovery-failed" });
                    chrome.runtime.sendMessage({
                      type: "report-error",
                      source: "editor-recovery-failed",
                      errorCode: payload?.errorCode || null,
                      zipBundled: true,
                    });
                  } catch {}
                },
              );
              setContentState((prev) => ({
                ...prev,
                ready: true,
                recordingFailed: true,
              }));
            }
          }
        }
        if (!tabId) return;
        // sandboxed ffmpeg iframes may not expose indexedDB; only run in top
        if (window.top !== window.self) return;
        const key = `chunks_ready_for:${tabId}`;
        if (changes[key]) {
          if (DEBUG_POSTSTOP)
            console.debug("[Screenity][Sandbox] storage fallback triggered", {
              key,
            });
          // sandboxed iframes may not expose IndexedDB; guard against localforage throwing
          if (!window.indexedDB) {
            if (DEBUG_POSTSTOP)
              console.warn(
                "[Screenity][Sandbox] storage fallback: no indexedDB in this context, skipping",
              );
            return;
          }

          buildBlobFromChunks()
            .then((blob) => {
              if (!blob) {
                if (DEBUG_POSTSTOP)
                  console.warn(
                    "[Screenity][Sandbox] storage fallback: no blob built",
                  );
                return;
              }
              if (DEBUG_POSTSTOP)
                console.debug(
                  "[Screenity][Sandbox] storage fallback: blob built",
                  {
                    size: blob.size,
                  },
                );
            })
            .catch((err) => {
              if (DEBUG_POSTSTOP)
                console.warn(
                  "[Screenity][Sandbox] storage fallback build error",
                  err,
                );
            });
        }
      } catch (err) {
        if (DEBUG_POSTSTOP)
          console.warn("[Screenity][Sandbox] storageListener error", err);
      }
    };

    // attach in both contexts; iframe needs editorRecordingError modal trigger,
    // chunks-ready fallback below self-guards on window.top===window.self
    let storageListenerAttached = false;
    chrome.storage.onChanged.addListener(storageListener);
    storageListenerAttached = true;

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      if (storageListenerAttached) {
        chrome.storage.onChanged.removeListener(storageListener);
      }
    };
  }, []);

  const onMessage = async (event) => {
    if (event.data.type === "recording-error-from-parent") {
      const payload = event.data.payload || {};
      // suppress when this editor already loaded; parent forwards every error
      const editorAlreadyLoaded =
        Boolean(contentStateRef.current?.ready) ||
        Boolean(contentStateRef.current?.blob);
      if (editorAlreadyLoaded) return;
      diagForward("sandbox-recording-error-received-via-parent", {
        error: String(payload?.error || "").slice(0, 120),
        why: String(payload?.why || "").slice(0, 240),
        errorCode: payload?.errorCode || null,
      });
      if (
        !editorErrorShownRef.current &&
        typeof contentStateRef.current?.openModal === "function"
      ) {
        editorErrorShownRef.current = true;
        const errCode = payload?.errorCode || "OPFS_LOAD_FAILED";
        contentStateRef.current.openModal(
          chrome.i18n.getMessage("opfsLoadErrorTitle"),
          payload?.why || chrome.i18n.getMessage("opfsLoadErrorDescription"),
          null,
          chrome.i18n.getMessage("permissionsModalDismiss"),
          () => {},
          () => {},
          null,
          null,
          null,
          true,
          chrome.i18n.getMessage("getHelpButton"),
          () => {
            triggerSupportDownload({ source: "opfs-load-failed" });
            chrome.runtime.sendMessage({
              type: "report-error",
              source: "opfs-load-failed",
              errorCode: errCode,
              zipBundled: true,
            });
          },
        );
        setContentState((prev) => ({
          ...prev,
          ready: true,
          recordingFailed: true,
        }));
      }
      return;
    }
    if (event.data.type === "updated-blob") {
      // discard timed-out/superseded ops
      const msgOpId = event.data._opId;
      if (msgOpId != null && msgOpId !== opIdRef.current) return;

      const base64 = event.data.base64;

      const blob = base64ToUint8Array(base64);

      const wasCropping = contentState.cropping;
      const isTopLevel = event.data.topLevel === true;
      const isFromAudio = event.data.fromAudio === true;

      if (isFromAudio && !event.data.skipReencode) {
        // legacy ffmpeg path needs a follow-up reencode; webcodecs skips
        sendMessage({
          type: "reencode-video",
          blob,
          duration: contentState.duration,
          topLevel: isTopLevel,
          _opId: event.data._opId,
        });
        return;
      }

      clearEditOp();

      setContentState((prev) => {
        const wasFirstReady = !prev.mp4ready && isTopLevel;
        if (wasFirstReady) {
          chrome.runtime.sendMessage({ type: "diag-editor-ready", path: "updated-blob" }).catch(() => {});
        }
        return {
          ...prev,
          blob: blob,
          mp4ready: true,
          hasBeenEdited: event.data.edited === false ? prev.hasBeenEdited : true,
          isFfmpegRunning: false,
          reencoding: false,
          trimming: false,
          cutting: false,
          muting: false,
          cropping: false,
          processingProgress: 0,
          editErrorType: null,
          hasTempChanges: !isTopLevel,

          ...(prev.fromCropper && { mode: "player", fromCropper: false }),
          ...(prev.fromAudio && { mode: "player", fromAudio: false }),
        };
      });

      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = async () => {
        if (process.env.SCREENITY_DEV_MODE === "true") {
          console.log("[Screenity][cut-debug] updated-blob received", {
            blobSize: blob?.length ?? blob?.size,
            blobIsBlob: blob instanceof Blob,
            measuredDuration: video.duration,
            previousDuration: contentState.duration,
            isFromAudio,
            wasCropping,
            wasCutting: contentState.cutting,
            wasMuting: contentState.muting,
            wasTrimming: contentState.trimming,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
          });
        }
        setContentState((prev) => ({
          ...prev,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          start: 0,
          end: 1,
          ...(wasCropping && { top: 0, left: 0 }),
        }));

        if (event.data.addToHistory) {
          contentState.addToHistory();
        }

        URL.revokeObjectURL(video.src);
        video.remove();
      };

      video.src = URL.createObjectURL(blob);

      if (!contentState.originalBlob && isTopLevel) {
        setContentState((prev) => ({
          ...prev,
          originalBlob: blob,
        }));
      }
    } else if (event.data.type === "download-mp4") {
      const base64 = event.data.base64;

      const blob = base64ToUint8Array(base64);
      const url = URL.createObjectURL(blob);
      await requestDownload(url, ".mp4");
      setContentState((prevContentState) => ({
        ...prevContentState,
        saved: true,
        isFfmpegRunning: false,
        downloading: false,
      }));
    } else if (event.data.type === "download-gif") {
      const base64 = event.data.base64;
      const blob = base64ToUint8Array(base64);
      const url = URL.createObjectURL(blob);
      await requestDownload(url, ".gif");
      setContentState((prevContentState) => ({
        ...prevContentState,
        saved: true,
        isFfmpegRunning: false,
        downloadingGIF: false,
      }));
    } else if (event.data.type === "new-frame") {
      // crop entries leak blob URLs otherwise
      const prevFrame = contentStateRef.current?.frame;
      if (typeof prevFrame === "string" && prevFrame.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prevFrame);
        } catch {}
      }
      const url = URL.createObjectURL(event.data.frame);
      setContentState((prevContentState) => ({
        ...prevContentState,
        frame: url,
        isFfmpegRunning: false,
        // Defer the mode flip until the frame is in hand so the cropper
        // doesn't mount over an empty stage (causing a black flash).
        ...(prevContentState.pendingCropEntry
          ? { mode: "crop", pendingCropEntry: false }
          : {}),
      }));
    } else if (event.data.type === "ffmpeg-loaded") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        ffmpeg: true,
        ffmpegLoaded: true,
        isFfmpegRunning: false,
      }));
    } else if (event.data.type === "ffmpeg-load-error") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        ffmpeg: true,
        noffmpeg: true,
        ffmpegLoaded: true,
        isFfmpegRunning: false,
      }));
      console.log("[Screenity][Editor] recording-complete sent from ffmpeg-load-error fallback");
      chrome.runtime.sendMessage({ type: "recording-complete" });
    } else if (event.data.type === "ffmpeg-error") {
      console.warn("FFmpeg error:", {
        error: event.data.error,
        errorMessage: event.data.errorMessage,
        opType: event.data.opType,
        errorStack: event.data.errorStack,
      });
      clearEditOp();

      // fall back to webm/rawBlob even if conversion fails
      setContentState((prev) => {
        const wasEditing = prev.isFfmpegRunning && (prev.cutting || prev.trimming || prev.muting || prev.cropping || prev.reencoding);
        return {
          ...prev,
          noffmpeg: true,
          ffmpegLoaded: true,
          isFfmpegRunning: false,
          muting: false,
          cutting: false,
          trimming: false,
          reencoding: false,
          cropping: false,
          processingProgress: 0,
          editErrorType: wasEditing ? "failed" : prev.editErrorType,
          ...(prev.rawBlob || prev.webm
            ? { ready: true, webm: prev.webm || prev.rawBlob }
            : {}),
        };
      });

      chrome.runtime.sendMessage({ type: "recording-complete" });
    } else if (event.data.type === "audio-too-large") {
      clearEditOp();
      setContentState((prev) => ({
        ...prev,
        isFfmpegRunning: false,
        muting: false,
        cutting: false,
        trimming: false,
        reencoding: false,
        cropping: false,
        processingProgress: 0,
        editErrorType: "audio-too-large",
      }));
    } else if (event.data.type === "edit-too-long") {
      // Too long for in-browser processing, reset so user can retry or trim.
      clearEditOp();
      setContentState((prev) => ({
        ...prev,
        isFfmpegRunning: false,
        muting: false,
        cutting: false,
        trimming: false,
        reencoding: false,
        cropping: false,
        processingProgress: 0,
        editErrorType: "too-long",
      }));
    } else if (event.data.type === "crop-update") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        mode: "crop",
        cropping: false,
        isFfmpegRunning: false,
        processingProgress: 0,
        start: 0,
        end: 1,
        fromCropper: false,
      }));

      setTimeout(() => {
        if (contentState.getFrame) {
          contentState.getFrame();
        }
      }, 100);
    } else if (event.data.type === "ffmpeg-progress") {
      const pct = Math.min(100, Math.max(0, Math.round(event.data.progress)));

      setContentState((prevContentState) => ({
        ...prevContentState,
        processingProgress: pct,
      }));
    } else if (event.data.type === "download-webm") {
      const base64 = event.data.base64;
      const blob = base64ToUint8Array(base64);

      const url = URL.createObjectURL(blob);
      await requestDownload(url, ".webm");

      setContentState((prevState) => ({
        ...prevState,
        saved: true,
        isFfmpegRunning: false,
        downloadingWEBM: false,
      }));
    }
  };

  useEffect(() => {
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onMessage]);

  // covers the race where parent received the storage change before this iframe mounted
  useEffect(() => {
    try {
      window.parent.postMessage(
        { type: "request-recording-error-state" },
        "*",
      );
    } catch {}
  }, []);

  const sendMessage = (message) => {
    window.parent.postMessage(message, "*");
  };

  const getBlob = async () => {
    if (
      contentState.noffmpeg ||
      (contentState.duration > contentState.editLimit && !contentState.override)
    ) {
      return;
    }

    const webmVideo = base64ToUint8Array(contentState.base64);

    setContentState((prevState) => ({
      ...prevState,
      webm: webmVideo,
      ready: true,
    }));

    if (contentState.offline && contentState.ffmpeg === true) {
    } else if (
      !contentState.updateChrome &&
      (contentState.duration <= contentState.editLimit || contentState.override)
    ) {
      setContentState((prevState) => ({
        ...prevState,
        isFfmpegRunning: true,
      }));
      sendMessage({
        type: "base64-to-blob",
        base64: contentState.base64,
        topLevel: true,
      });
    }

    chrome.runtime.sendMessage({ type: "recording-complete" });
  };

  useEffect(() => {
    if (!contentState.base64) return;
    if (!contentState.ffmpeg) return;
    if (!contentState.ffmpegLoaded) return;

    getBlob();
  }, [contentState.base64, contentState.ffmpeg, contentState.ffmpegLoaded]);

  // 30s fallback for blocked CDN / worker crash; force recovery mode
  useEffect(() => {
    if (!contentState.base64) return;
    if (!contentState.ffmpeg) return;
    if (contentState.ffmpegLoaded) return;
    if (contentState.noffmpeg) return;

    const timer = setTimeout(() => {
      const current = contentStateRef.current;
      if (current.ffmpegLoaded || current.noffmpeg) return;
      chrome.storage.local.set({ editorLoadTimeoutAt: Date.now() });
      setContentState((prev) => {
        if (prev.ffmpegLoaded || prev.noffmpeg) return prev;
        // also set ready: getBlob early-returns on noffmpeg so ready wouldn't fire
        const fallbackWebm = prev.webm || prev.rawBlob;
        return {
          ...prev,
          noffmpeg: true,
          ffmpegLoaded: true,
          fallback: true,
          ...(fallbackWebm && !prev.ready
            ? { webm: fallbackWebm, ready: true }
            : {}),
        };
      });
      console.log("[Screenity][Editor] recording-complete sent from ffmpeg-load-timeout fallback");
      chrome.runtime.sendMessage({ type: "recording-complete" });
    }, 30000);

    return () => clearTimeout(timer);
  }, [contentState.base64, contentState.ffmpeg, contentState.ffmpegLoaded, contentState.noffmpeg]);

  const getImage = useCallback(async () => {
    if (!contentState.blob) return;
    if (!contentState.ffmpeg) return;
    if (contentState.isFfmpegRunning) return;

    setContentState((prevState) => ({
      ...prevState,
      isFfmpegRunning: true,
    }));

    sendMessage({ type: "get-frame", time: 0, blob: contentState.blob });
  }, [contentState.blob, contentState.ffmpeg, contentState.isFfmpegRunning]);

  const beginEditOp = () => {
    if (editWatchdogRef.current) {
      clearTimeout(editWatchdogRef.current);
    }
    opIdRef.current += 1;
    const id = opIdRef.current;
    editWatchdogRef.current = setTimeout(() => {
      editWatchdogRef.current = null;
      opIdRef.current += 1;
      setContentState((prev) => ({
        ...prev,
        isFfmpegRunning: false,
        muting: false,
        cutting: false,
        trimming: false,
        reencoding: false,
        cropping: false,
        processingProgress: 0,
        editErrorType: "timeout",
      }));
    }, 5 * 60 * 1000);
    return id;
  };

  const clearEditOp = () => {
    if (editWatchdogRef.current) {
      clearTimeout(editWatchdogRef.current);
      editWatchdogRef.current = null;
    }
  };

  const cancelEditOp = () => {
    opIdRef.current += 1;
    clearEditOp();
    setContentState((prev) => ({
      ...prev,
      isFfmpegRunning: false,
      muting: false,
      cutting: false,
      trimming: false,
      reencoding: false,
      cropping: false,
      processingProgress: 0,
    }));
  };

  const addAudio = async (videoBlob, audioBlob, volume) => {
    if (contentState.isFfmpegRunning) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    const sourceBlob = videoBlob || contentState.blob || contentState.webm;
    const opId = beginEditOp();

    setContentState((prev) => ({
      ...prev,
      isFfmpegRunning: true,
      processingProgress: 0,
      editErrorType: null,
    }));

    sendMessage({
      type: "add-audio-to-video",
      blob: sourceBlob,
      audio: audioBlob,
      duration: contentState.duration,
      volume: volume,
      replaceAudio: contentState.replaceAudio,
      topLevel: false,
      _opId: opId,
    });
  };

  const handleTrim = async (cut) => {
    if (contentState.isFfmpegRunning) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;
    // undo/redo/keyboard/programmatic restore can leave start>=end; bail clearly
    if (
      !Number.isFinite(contentState.start) ||
      !Number.isFinite(contentState.end) ||
      contentState.start >= contentState.end
    ) {
      setContentState((prev) => ({
        ...prev,
        editErrorType: "invalid-trim-range",
      }));
      return;
    }

    const sourceBlob = contentState.blob;
    const opId = beginEditOp();

    if (process.env.SCREENITY_DEV_MODE === "true") {
      console.log("[Screenity][cut-debug] handleTrim dispatch", {
        cut,
        opId,
        sourceBlobSize: sourceBlob?.size,
        sourceBlobType: sourceBlob?.type,
        duration: contentState.duration,
        start: contentState.start,
        end: contentState.end,
        startTime: contentState.start * contentState.duration,
        endTime: contentState.end * contentState.duration,
        expectedOutputDuration: cut
          ? contentState.duration -
            (contentState.end * contentState.duration -
              contentState.start * contentState.duration)
          : contentState.end * contentState.duration -
            contentState.start * contentState.duration,
      });
    }

    setContentState((prev) => ({
      ...prev,
      isFfmpegRunning: true,
      processingProgress: 0,
      editErrorType: null,
      [cut ? "cutting" : "trimming"]: true,
    }));

    sendMessage({
      type: "cut-video",
      blob: sourceBlob,
      startTime: contentState.start * contentState.duration,
      endTime: contentState.end * contentState.duration,
      cut,
      duration: contentState.duration,
      encode: false,
      topLevel: false,
      _opId: opId,
    });
  };

  const handleMute = async () => {
    if (contentState.isFfmpegRunning) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;
    if (
      !Number.isFinite(contentState.start) ||
      !Number.isFinite(contentState.end) ||
      contentState.start >= contentState.end
    ) {
      setContentState((prev) => ({
        ...prev,
        editErrorType: "invalid-trim-range",
      }));
      return;
    }

    const sourceBlob = contentState.blob;
    const opId = beginEditOp();

    setContentState((prev) => ({
      ...prev,
      muting: true,
      isFfmpegRunning: true,
      processingProgress: 0,
      editErrorType: null,
    }));

    sendMessage({
      type: "mute-video",
      blob: sourceBlob,
      startTime: contentState.start * contentState.duration,
      endTime: contentState.end * contentState.duration,
      duration: contentState.duration,
      topLevel: false,
      _opId: opId,
    });
  };

  const handleCrop = async (x, y, width, height) => {
    if (contentState.isFfmpegRunning || contentState.cropping) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    const opId = beginEditOp();

    setContentState((prevState) => ({
      ...prevState,
      cropping: true,
      isFfmpegRunning: true,
      processingProgress: 0,
      editErrorType: null,
    }));

    const sourceBlob = contentState.blob;

    sendMessage({
      type: "crop-video",
      blob: sourceBlob,
      x,
      y,
      width,
      height,
      topLevel: false,
      _opId: opId,
    });

    return true;
  };

  const handleReencode = async (topLevel = false) => {
    if (contentState.isFfmpegRunning) return;

    const sourceBlob = contentState.blob;
    const opId = beginEditOp();

    setContentState((prevState) => ({
      ...prevState,
      isFfmpegRunning: true,
      reencoding: true,
      processingProgress: 0,
      editErrorType: null,
    }));

    sendMessage({
      type: "reencode-video",
      blob: sourceBlob,
      duration: contentState.duration,
      topLevel,
      _opId: opId,
    });

    return true;
  };

  const sanitizeDownloadFilename = (name, { maxLen = 180 } = {}) => {
    let out = String(name ?? "");
    out = out.replace(/[\\/:*?"<>|]/g, " ");
    out = out.replace(/[\u0000-\u001F\u007F]/g, " ");
    out = out.replace(/\s+/g, " ").trim();
    out = out.replace(/[. ]+$/g, "");

    if (!out) out = "Screenity recording";
    if (out.length > maxLen) out = out.slice(0, maxLen).trim();

    return out;
  };

  const requestDownload = async (url, ext) => {
    // rapid double-click would otherwise create two downloads + double-revoke
    if (contentStateRef.current?.downloadInProgress) {
      console.warn("[Screenity] download already in progress, ignoring");
      return;
    }
    setContentState((prev) => ({
      ...prev,
      downloadInProgress: true,
      downloadError: null,
    }));

    const rawTitle = contentStateRef.current.title || "Screenity recording";

    const base = sanitizeDownloadFilename(rawTitle);
    const filename = `${base}${ext}`;

    let revoked = false;
    const revoke = () => {
      if (revoked) return;
      revoked = true;
      try {
        URL.revokeObjectURL(url);
      } catch {}
      try {
        setContentState((prev) => ({ ...prev, downloadInProgress: false }));
      } catch {}
    };

    // Brave: route via background for download
    if ((navigator.brave && (await navigator.brave.isBrave())) || false) {
      const resp = await fetch(url);
      const blob = await resp.blob();
      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          chrome.runtime.sendMessage({
            type: "request-download",
            base64: reader.result,
            title: filename,
          });
          revoke();
          resolve();
        };
        reader.readAsDataURL(blob);
      });
      return;
    }

    const downloadId = await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, saveAs: true }, (id) => {
        const lastErr = chrome.runtime.lastError;
        // user cancelled Save-As; don't show "Download failed"
        const errMsg = String(lastErr?.message || "");
        if (errMsg.includes("USER_CANCELED") || errMsg.includes("canceled")) {
          revoke();
          resolve(null);
          return;
        }
        if (lastErr || !id) {
          reject(lastErr || new Error("Download failed"));
        } else {
          resolve(id);
        }
      });
    });
    if (downloadId == null) return;

    await new Promise((resolve) => {
      let settled = false;
      const timeoutMs = 10 * 60 * 1000;
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          chrome.downloads.onChanged.removeListener(handler);
        } catch {}
        revoke();
        console.warn(
          "[Screenity] download status listener timed out, releasing handle",
          { downloadId, filename, timeoutMs },
        );
        // surface error so editor toasts fire; silent resolve would mask as success
        try {
          setContentState((prev) => ({
            ...prev,
            downloadError: "timeout",
            downloadInProgress: false,
          }));
        } catch {}
        resolve();
      }, timeoutMs);

      const handler = async (delta) => {
        if (delta.id !== downloadId || !delta.state) return;

        const done = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          chrome.downloads.onChanged.removeListener(handler);
          revoke();
          resolve();
        };

        if (
          delta.state.current === "interrupted" &&
          delta.error?.current !== "USER_CANCELED"
        ) {
          try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            // sendMessage caps at ~64MB; base64 inflates 4/3, so cap at 30MB
            const BASE64_FALLBACK_MAX_BYTES = 30 * 1024 * 1024;
            if (blob.size > BASE64_FALLBACK_MAX_BYTES) {
              try {
                setContentState((prev) => ({
                  ...prev,
                  downloadError: "interrupted-too-large",
                  downloadInProgress: false,
                }));
              } catch {}
              try {
                chrome.runtime.sendMessage({
                  type: "show-toast",
                  message: chrome.i18n.getMessage(
                    "downloadInterruptedLargeToast",
                  ),
                  timeout: 8000,
                });
              } catch {}
            } else {
              await new Promise((res) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  chrome.runtime.sendMessage({
                    type: "request-download",
                    base64: reader.result,
                    title: filename,
                  });
                  res();
                };
                reader.readAsDataURL(blob);
              });
            }
          } finally {
            done();
          }
        } else if (
          delta.state.current === "complete" ||
          delta.state.current === "interrupted"
        ) {
          done();
        }
      };

      chrome.downloads.onChanged.addListener(handler);
    });
  };

  // fMP4 -> standard MP4 via container copy. QuickTime/editors need fastStart.
  // BufferTarget is required: fastStart:false patches the mdat size with a
  // positioned write at the end, which a stream-to-blob pipe would drop.
  const remuxFragmentedToStandardMp4 = async (fragmentedBlob, onProgress) => {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(fragmentedBlob),
    });
    const target = new BufferTarget();
    const output = new Output({
      target,
      format: new Mp4OutputFormat({ fastStart: false }),
    });
    const conversion = await Conversion.init({
      input,
      output,
      video: { forceTranscode: false },
      audio: { forceTranscode: false },
    });
    if (typeof onProgress === "function") {
      conversion.onProgress = (p) => onProgress(p);
    }
    await conversion.execute();
    return new Blob([target.buffer], { type: "video/mp4" });
  };

  // OPFS sync access handle in an offscreen worker; bypasses BufferTarget's 2 GB cap
  const remuxViaOffscreenOpfs = async (fragmentedBlob, onProgress) => {
    const requestId =
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const devLog =
      process.env.SCREENITY_DEV_MODE === "true"
        ? (label, data) =>
            console.log("[remux][sandbox]", label, data || "")
        : () => {};
    devLog("offscreen-remux-start", {
      requestId,
      inputBytes: fragmentedBlob?.size,
    });

    const progressListener = (msg) => {
      if (
        msg?.type === "remux-progress" &&
        msg.requestId === requestId &&
        typeof onProgress === "function"
      ) {
        onProgress(msg.progress);
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    // sendMessage's structured clone is lossy for Blobs across the SW
    // (BlobSource rejects with "blob must be a Blob"); transport via OPFS+filename
    const outputFileName = `remux-${requestId}.mp4`;
    let opfsDir;
    try {
      opfsDir = await navigator.storage.getDirectory();
    } catch (err) {
      chrome.runtime.onMessage.removeListener(progressListener);
      throw new Error(
        `opfs-unavailable: ${String(err?.message || err).slice(0, 120)}`,
      );
    }

    // reuse OPFS input when size matches; edits diverge so fall back to staging
    let stagedInputFileName = null;
    let inputFileName;
    try {
      const { lastRecordingBackendRef } = await chrome.storage.local.get([
        "lastRecordingBackendRef",
      ]);
      if (
        lastRecordingBackendRef?.backend === "opfs" &&
        typeof lastRecordingBackendRef.fileName === "string" &&
        lastRecordingBackendRef.fileName.length > 0
      ) {
        try {
          const handle = await opfsDir.getFileHandle(
            lastRecordingBackendRef.fileName,
          );
          const opfsFile = await handle.getFile();
          if (
            fragmentedBlob &&
            typeof fragmentedBlob.size === "number" &&
            opfsFile.size === fragmentedBlob.size
          ) {
            inputFileName = lastRecordingBackendRef.fileName;
            devLog("reused-opfs-input", { inputFileName });
          } else {
            devLog("opfs-input-size-mismatch-skipping-reuse", {
              opfsBytes: opfsFile.size,
              blobBytes: fragmentedBlob?.size,
            });
          }
        } catch {}
      }
    } catch {}

    try {
      if (!inputFileName) {
        stagedInputFileName = `remux-in-${requestId}.mp4`;
        const inputHandle = await opfsDir.getFileHandle(stagedInputFileName, {
          create: true,
        });
        const writable = await inputHandle.createWritable();
        await writable.write(fragmentedBlob);
        await writable.close();
        inputFileName = stagedInputFileName;
        devLog("staged-input-in-opfs", { inputFileName });
      }

      const response = await chrome.runtime.sendMessage({
        type: "remux-request",
        requestId,
        inputFileName,
        outputFileName,
      });
      if (!response || response.ok !== true) {
        devLog("offscreen-remux-response-bad", response);
        throw new Error(response?.error || "offscreen-remux-failed");
      }

      const outputHandle = await opfsDir.getFileHandle(outputFileName);
      const file = await outputHandle.getFile();
      const outputBlob = new Blob([file], { type: "video/mp4" });
      devLog("offscreen-remux-ok", { outputBytes: outputBlob.size });
      return outputBlob;
    } finally {
      chrome.runtime.onMessage.removeListener(progressListener);
      // never delete the recording itself
      if (stagedInputFileName) {
        try {
          await opfsDir.removeEntry(stagedInputFileName).catch(() => {});
        } catch {}
      }
      // output left in place; worker's age-based sweep cleans next remux
    }
  };

  const download = async () => {
    // ref: rapid clicks fire before state propagates
    const latest = contentStateRef.current || contentState;
    // isFfmpegRunning leaks from background poll handlers and would
    // intermittently swallow real user clicks; downloading is the real lock.
    if (latest.downloading) return;

    setContentState((prev) => ({
      ...prev,
      downloading: true,
      isFfmpegRunning: true,
      processingProgress: 0,
    }));

    const progressHandler = (p) =>
      setContentState((prev) => ({
        ...prev,
        processingProgress: Math.round(p * 100),
      }));

    const inputSize = contentState.blob?.size || 0;
    const remuxStartedAt = Date.now();
    let remuxedBlob = null;
    let remuxPath = null;

    // tier 1: offscreen+OPFS, bounded memory
    try {
      diagForward("remux-offscreen-start", { inputBytes: inputSize });
      remuxedBlob = await remuxViaOffscreenOpfs(
        contentState.blob,
        progressHandler,
      );
      remuxPath = "offscreen-opfs";
      diagForward("remux-offscreen-ok", { inputBytes: inputSize });
    } catch (err) {
      console.warn("[Screenity] offscreen remux failed, falling back", err);
      diagForward("remux-offscreen-fail", {
        inputBytes: inputSize,
        err: String(err?.message || err).slice(0, 200),
      });
    }

    // tier 2: in-sandbox BufferTarget, capped at ~2 GB
    if (!remuxedBlob) {
      try {
        remuxedBlob = await remuxFragmentedToStandardMp4(
          contentState.blob,
          progressHandler,
        );
        remuxPath = "buffer-target";
        diagForward("remux-buffer-target-ok", { inputBytes: inputSize });
      } catch (err) {
        console.warn(
          "[Screenity] buffer-target remux failed, falling back",
          err,
        );
        diagForward("remux-buffer-target-fail", {
          inputBytes: inputSize,
          err: String(err?.message || err).slice(0, 200),
        });
      }
    }

    const remuxDurationMs = Date.now() - remuxStartedAt;
    const finalPath = remuxPath || "fmp4-fallback";
    if (process.env.SCREENITY_DEV_MODE === "true") {
      console.log("[remux][sandbox] summary", {
        path: finalPath,
        durationMs: remuxDurationMs,
        inputBytes: inputSize,
        outputBytes: remuxedBlob?.size || 0,
      });
    }
    setContentState((prev) => ({
      ...prev,
      lastDownloadInfo: {
        path: finalPath,
        durationMs: remuxDurationMs,
        inputBytes: inputSize,
        outputBytes: remuxedBlob?.size || 0,
        at: Date.now(),
      },
    }));

    try {
      if (remuxedBlob) {
        const url = URL.createObjectURL(remuxedBlob);
        await requestDownload(url, ".mp4");
        URL.revokeObjectURL(url);
        setContentState((prev) => ({ ...prev, saved: true }));
        diagForward("remux-delivered", {
          inputBytes: inputSize,
          outputBytes: remuxedBlob.size || 0,
          path: remuxPath,
        });
      } else {
        throw new Error("both-remux-paths-failed");
      }
    } catch (err) {
      console.error("MP4 download failed:", err);
      // tier 3: serve fMP4 as-is so the user doesn't lose the recording
      try {
        const url = URL.createObjectURL(contentState.blob);
        await requestDownload(url, ".mp4");
        URL.revokeObjectURL(url);
        setContentState((prev) => ({ ...prev, saved: true }));
      } catch (fallbackErr) {
        console.error("MP4 fallback download failed:", fallbackErr);
      }
    } finally {
      setContentState((prev) => ({
        ...prev,
        downloading: false,
        isFfmpegRunning: false,
        processingProgress: 0,
      }));
    }
  };

  const downloadWEBM = async () => {
    if (contentState.downloadingWEBM) return;

    const sourceBlob = contentState.blob || contentState.webm;

    if (!sourceBlob) {
      return;
    }

    const hasFFmpeg = contentState.ffmpegLoaded && !contentState.noffmpeg;
    const isAlreadyWebm = sourceBlob.type === "video/webm";

    if (!hasFFmpeg || isAlreadyWebm) {
      const url = URL.createObjectURL(sourceBlob);
      await requestDownload(url, ".webm");

      setContentState((prevState) => ({
        ...prevState,
        downloadingWEBM: false,
        isFfmpegRunning: false,
        saved: true,
      }));
      return;
    }

    if (!contentState.hasBeenEdited && contentState.webm) {
      const url = URL.createObjectURL(contentState.webm);
      await requestDownload(url, ".webm");

      setContentState((prev) => ({
        ...prev,
        downloadingWEBM: false,
        isFfmpegRunning: false,
        saved: true,
      }));
      return;
    }

    setContentState((prevState) => ({
      ...prevState,
      downloadingWEBM: true,
      isFfmpegRunning: true,
      processingProgress: 0,
    }));

    sendMessage({
      type: "to-webm",
      blob: sourceBlob,
      duration: contentState.duration,
    });

    await waitForUpdatedBlob();

    setContentState((prevState) => ({
      ...prevState,
      downloadingWEBM: false,
      isFfmpegRunning: false,
      saved: true,
    }));
  };

  const downloadGIF = async () => {
    if (contentState.isFfmpegRunning || contentState.downloading) {
      return;
    }
    if (contentState.duration > 30) {
      try {
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: chrome.i18n.getMessage("downloadGIFTooLongToast"),
          timeout: 6000,
        });
      } catch {}
      return;
    }

    setContentState((prevState) => ({
      ...prevState,
      downloadingGIF: true,
      isFfmpegRunning: true,
    }));

    sendMessage({
      type: "to-gif",
      blob: contentState.blob,
    });
  };

  const loadFFmpeg = async () => {
    sendMessage({ type: "load-ffmpeg" });
  };

  const waitForUpdatedBlob = () => {
    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.data?.type === "updated-blob") {
          window.removeEventListener("message", handler);
          resolve();
        }
      };
      window.addEventListener("message", handler);
    });
  };

  contentState.undo = undo;
  contentState.redo = redo;
  contentState.addToHistory = addToHistory;
  contentState.handleTrim = handleTrim;
  contentState.handleMute = handleMute;
  contentState.download = download;
  contentState.handleCrop = handleCrop;
  contentState.handleReencode = handleReencode;
  contentState.getFrame = getImage;
  contentState.downloadGIF = downloadGIF;
  contentState.downloadWEBM = downloadWEBM;
  contentState.addAudio = addAudio;
  contentState.loadFFmpeg = loadFFmpeg;
  contentState.waitForUpdatedBlob = waitForUpdatedBlob;
  contentState.createBackup = createBackup;
  contentState.restoreBackup = restoreBackup;
  contentState.clearBackup = clearBackup;
  contentState.cancelEditOp = cancelEditOp;

  return (
    <ContentStateContext.Provider value={[contentState, setContentState]}>
      {props.children}
      {process.env.SCREENITY_DEV_MODE === "true" && (
        <DevHUD
          setContentState={setContentState}
          contentStateRef={contentStateRef}
          lastDownloadInfo={contentState.lastDownloadInfo}
          lastRecordingBackend={contentState.lastRecordingBackend}
        />
      )}
    </ContentStateContext.Provider>
  );
};

export default ContentState;
