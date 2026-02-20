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
import {
  formatLocalTimestamp,
  getHostnameFromUrl,
  sanitizeFilenameBase,
} from "../../utils/filenameHelpers";
import {
  debugRecordingEventWithSession,
  isRecordingDebugEnabled,
} from "../../utils/recordingDebug";

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
// Enable post-stop debug logs for sandbox
const DEBUG_POSTSTOP = true;

const ContentState = (props) => {
  const videoChunks = useRef([]);
  const makeVideoCheck = useRef(false);
  const chunkCount = useRef(0);
  const recdbgSessionRef = useRef(null);
  const tabIdRef = useRef(null);

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

  const defaultState = {
    time: 0,
    editLimit: 420,
    blob: null,
    webm: null,
    originalBlob: null,
    updatePlayerTime: false,
    start: 0, // Add missing properties here
    end: 1,
    trimming: false,
    cutting: false,
    muting: false,
    history: [{}], // Initialize history with a default state
    redoHistory: [],
    undoDisabled: true,
    redoDisabled: true,
    duration: 0,
    mode: "player",
    ffmpegLoaded: false,
    frame: null,
    getFrame: null,
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
    const items = [];

    await chunksStore.ready();
    if (DEBUG_POSTSTOP)
      console.debug(
        "[Screenity][Sandbox] buildBlobFromChunks: chunksStore ready, iterating",
      );

    await chunksStore.iterate((value) => (items.push(value), undefined));
    if (DEBUG_POSTSTOP)
      console.debug("[Screenity][Sandbox] buildBlobFromChunks: items loaded", {
        count: items.length,
      });

    items.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    const parts = items.map((c) =>
      c.chunk instanceof Blob ? c.chunk : new Blob([c.chunk]),
    );

    if (!parts.length) {
      debug("No chunks found in IndexedDB");
      if (DEBUG_POSTSTOP)
        console.warn(
          "[Screenity][Sandbox] buildBlobFromChunks: no parts found in IndexedDB",
        );
      debugRecordingEventWithSession(recdbgSessionRef.current, "blob-empty", {
        chunkCount: 0,
      });
      return null;
    }

    const first = parts[0];
    const inferredType = first?.type || "video/webm";

    const blob = new Blob(parts, { type: inferredType });
    if (DEBUG_POSTSTOP)
      console.debug(
        "[Screenity][Sandbox] buildBlobFromChunks: reconstructed blob",
        {
          size: blob.size,
          type: blob.type,
        },
      );
    reconstructVideo(blob);
    return blob;
  };

  // useEffect(() => {
  //   contentStateRef.current = contentState;
  // }, [contentState]);

  // Check if the user is offline
  // useEffect(() => {
  //   if (!navigator.onLine) {
  //     setContentState((prevState) => ({
  //       ...prevState,
  //       offline: true,
  //     }));
  //   }
  // }, []);

  // Generate a title based on the current time unless this is a tab recording
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

  // Show a popup when attempting to close the tab if the user has not downloaded their video
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

  const addToHistory = useCallback(() => {
    setContentState((prevState) => ({
      ...prevState,
      history: [...prevState.history, prevState],
      redoHistory: [], // Clear redo history when a new state is added
    }));
  }, [contentState]);

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

    // Get duration of video blob
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = async () => {
      setContentState((prevState) => ({
        ...prevState,
        duration: video.duration,
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
    let blob = withBlob
      ? withBlob
      : new Blob(videoChunks.current, { type: "video/webm; codecs=vp8,opus" });

    if (blob.type === "video/mp4") {
      //const TOO_BIG_BYTES = 200 * 1024 * 1024;
      // const TOO_BIG_BYTES = 0;
      // if (blob.size > TOO_BIG_BYTES) {
      //   // Convert Blob → base64 first so we can pass to sandbox
      //   const reader = new FileReader();
      //   reader.onloadend = () => {
      //     const base64 = reader.result;

      //     setContentState((prev) => ({
      //       ...prev,
      //       base64,
      //       compressing: true,
      //       mp4ready: false,
      //       ready: false,
      //       rawBlob: prev.rawBlob || blob,
      //     }));

      //     // Send to sandbox for compression
      //     sendMessage({
      //       type: "compress-video",
      //       base64,
      //       topLevel: true,
      //     });
      //   };
      //   reader.readAsDataURL(blob);

      //   return;
      // }

      setContentState((prev) => ({
        ...prev,
        blob: blob,
        webm: null,
        mp4ready: true,
        ready: true,
        rawBlob: blob,
        isFfmpegRunning: false,
        noffmpeg: false,
      }));

      // Extract duration, width, height
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        setContentState((prev) => ({
          ...prev,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        }));

        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(blob);

      chrome.runtime.sendMessage({ type: "recording-complete" });
      return;
    }

    const { recordingDuration } = await chrome.storage.local.get(
      "recordingDuration",
    );

    // Check if token is present
    const { token } = await chrome.storage.local.get("token");

    let driveEnabled = false;

    if (token && token !== null) {
      driveEnabled = true;
    }

    setContentState((prevState) => ({
      ...prevState,
      rawBlob: blob,
      duration: recordingDuration / 1000,
    }));

    // Check if user is in Windows 10
    const isWindows10 = navigator.userAgent.match(/Windows NT 10.0/);

    try {
      if (recordingDuration > 0 && recordingDuration !== null) {
        if (!isWindows10) {
          fixWebmDuration(
            blob,
            recordingDuration,
            async (fixedWebm) => {
              // Skip conversion only if Chrome is outdated or recording exceeds edit limit
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

          // Skip conversion only if Chrome is outdated or recording exceeds edit limit
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
        /// Skip fixing duration
        // Skip conversion only if Chrome is outdated or recording exceeds edit limit
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
      setContentState((prevState) => ({
        ...prevState,
        webm: blob,
        ready: true,
      }));
      chrome.runtime.sendMessage({ type: "recording-complete" });
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
          );
        }
      });
    }
  };

  useEffect(() => {
    chunkCount.current = contentState.chunkCount;
  }, [contentState.chunkCount]);

  const handleBatch = (chunks, sendResponse) => {
    if (DEBUG_POSTSTOP)
      console.debug("[Screenity][Sandbox] handleBatch called", {
        chunksLen: chunks?.length,
      });
    // Process chunks asynchronously, but do not make this function async
    (async () => {
      try {
        await Promise.all(
          chunks.map(async (chunk) => {
            if (contentStateRef.current.chunkIndex >= chunkCount.current) {
              return; // Skip processing
            }

            const chunkData = base64ToUint8Array(chunk.chunk);
            if (DEBUG_POSTSTOP)
              console.debug("[Screenity][Sandbox] handleBatch pushing chunk", {
                index: chunk.index,
                size: chunkData?.size || null,
              });
            videoChunks.current.push(chunkData);

            // Assuming setContentState doesn't need to be awaited
            setContentState((prevState) => ({
              ...prevState,
              chunkIndex: prevState.chunkIndex + 1,
            }));
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

    return true; // Keep the messaging channel open for the response
  };

  // Check Chrome version
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

  const makeVideoTab = (sendResponse = null, message) => {
    if (makeVideoCheck.current) return;
    makeVideoCheck.current = true;
    if (DEBUG_POSTSTOP)
      console.debug("[Screenity][Sandbox] makeVideoTab invoked", {
        override: message?.override,
      });
    setContentState((prevState) => ({
      ...prevState,
      override: message.override,
    }));
    // All chunks received, reconstruct video
    checkMemory();
    reconstructVideo();

    setTimeout(() => {
      const s = contentStateRef.current;
      if (DEBUG_POSTSTOP)
        console.debug("[Screenity][Sandbox] makeVideoTab: post-check", {
          chunkCount: s?.chunkCount,
          chunkIndex: s?.chunkIndex,
          rawBlob: Boolean(s?.rawBlob),
          ready: s?.ready,
        });
      const complete = s?.chunkCount > 0 && s?.chunkIndex >= s?.chunkCount;
      if (complete && !s?.ready && s?.rawBlob) {
        setContentState((prev) => ({
          ...prev,
          webm: prev.webm || prev.rawBlob,
          ready: true,
          noffmpeg: true,
          isFfmpegRunning: false,
        }));
        chrome.runtime.sendMessage({ type: "recording-complete" });
      }
    }, 30000);

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
        setContentState((prevState) => ({
          ...prevState,
          chunkCount: message.count,
          override: message.override,
        }));
      } else if (message.type === "ping") {
        sendResponse({ status: "ready" });
      } else if (message.type === "new-chunk-tab") {
        if (DEBUG_POSTSTOP)
          console.debug("[Screenity][Sandbox] received new-chunk-tab", {
            chunksLen: message?.chunks?.length,
          });
        return handleBatch(message.chunks, sendResponse);
      } else if (message.type === "make-video-tab") {
        if (DEBUG_POSTSTOP)
          console.debug("[Screenity][Sandbox] received make-video-tab");
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
          noffmpeg: false, // Pretending FFmpeg is loaded (using Mediabunny)
          isFfmpegRunning: false,
          editLimit: 3600, // Set high edit limit (1 hour) for recovery mode
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

        return true; // Keep message port open for async response
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

        return true; // Keep message port open for async response
      } else if (message.type === "fallback-recording") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          fallback: true,
          noffmpeg: false,
          isFfmpegRunning: true,
          editLimit: 3600,
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

  useEffect(() => {
    const messageListener = (message, sender, sendResponse) => {
      const shouldKeepPortOpen = onChromeMessage(message, sender, sendResponse);
      return shouldKeepPortOpen === true;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Storage fallback listener: watch for background writing a `chunks_ready_for:<tabId>` key
    const storageListener = (changes, areaName) => {
      if (areaName !== "local") return;
      try {
        const tabId = tabIdRef.current;
        if (!tabId) return;
        const key = `chunks_ready_for:${tabId}`;
        if (changes[key]) {
          if (DEBUG_POSTSTOP)
            console.debug("[Screenity][Sandbox] storage fallback triggered", {
              key,
            });
          // Ensure IndexedDB is available in this frame before attempting
          // to read chunks. Some sandboxed/iframe contexts (ffmpeg iframe)
          // may not expose IndexedDB; guard to avoid localforage throwing.
          if (!window.indexedDB) {
            if (DEBUG_POSTSTOP)
              console.warn(
                "[Screenity][Sandbox] storage fallback: no indexedDB in this context, skipping",
              );
            return;
          }

          // Asynchronously attempt to build the blob from IndexedDB
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

    // Only attach the storage fallback listener in the top-level window
    // (editor/page) — avoid running this inside sandboxed iframes used for
    // FFmpeg which may not expose IndexedDB.
    let storageListenerAttached = false;
    if (window.top === window.self) {
      chrome.storage.onChanged.addListener(storageListener);
      storageListenerAttached = true;
    } else if (DEBUG_POSTSTOP) {
      console.debug(
        "[Screenity][Sandbox] running inside an iframe; skipping storage fallback listener",
      );
    }

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      if (storageListenerAttached) {
        chrome.storage.onChanged.removeListener(storageListener);
      }
    };
  }, []);

  const onMessage = async (event) => {
    if (event.data.type === "updated-blob") {
      const base64 = event.data.base64;

      const blob = base64ToUint8Array(base64);

      const wasCropping = contentState.cropping;
      const isTopLevel = event.data.topLevel === true;
      const isFromAudio = event.data.fromAudio === true;

      if (isFromAudio) {
        sendMessage({
          type: "reencode-video",
          blob,
          duration: contentState.duration,
          topLevel: isTopLevel,
        });
        return;
      }

      setContentState((prev) => ({
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
        hasTempChanges: !isTopLevel,

        ...(prev.fromCropper && { mode: "player", fromCropper: false }),
        ...(prev.fromAudio && { mode: "player", fromAudio: false }),
      }));

      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = async () => {
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
      // Download the blob
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
      // const blob = new Blob([base64ToUint8Array(base64)], {
      //   type: "image/gif",
      // });
      const blob = base64ToUint8Array(base64);
      // Download the blob
      const url = URL.createObjectURL(blob);
      await requestDownload(url, ".gif");
      setContentState((prevContentState) => ({
        ...prevContentState,
        saved: true,
        isFfmpegRunning: false,
        downloadingGIF: false,
      }));
    } else if (event.data.type === "new-frame") {
      const url = URL.createObjectURL(event.data.frame);
      setContentState((prevContentState) => ({
        ...prevContentState,
        frame: url,
        isFfmpegRunning: false,
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

      // if (!navigator.onLine) {
      //   setContentState((prevState) => ({
      //     ...prevState,
      //     offline: true,
      //   }));

      //   // Try loading ffmpeg again when reconnected to the internet
      //   window.addEventListener("online", () => {
      //     setContentState((prevState) => ({
      //       ...prevState,
      //       offline: false,
      //     }));
      //     contentState.loadFFmpeg();
      //   });
      // }
    } else if (event.data.type === "ffmpeg-error") {
      console.warn("FFmpeg error:", event.data.error);

      // Fallback: allow playback/download using webm/rawBlob even if conversion fails
      setContentState((prev) => ({
        ...prev,
        noffmpeg: true,
        ffmpegLoaded: true, // treat as “done trying”
        isFfmpegRunning: false,
        processingProgress: 0,
        ...(prev.rawBlob || prev.webm
          ? { ready: true, webm: prev.webm || prev.rawBlob }
          : {}),
      }));

      chrome.runtime.sendMessage({ type: "recording-complete" });
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
      // const blob = new Blob([base64ToUint8Array(base64)], {
      //   type: "video/webm",
      // });
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

  // Listen to PostMessage events
  useEffect(() => {
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onMessage]);

  const sendMessage = (message) => {
    window.parent.postMessage(message, "*");
  };

  const getBlob = async () => {
    // Skip conversion only if Chrome is outdated or recording exceeds edit limit
    if (
      contentState.noffmpeg ||
      (contentState.duration > contentState.editLimit && !contentState.override)
    ) {
      return;
    }

    // const webmVideo = new Blob([base64ToUint8Array(contentState.base64)], {
    //   type: "video/webm",
    // });

    const webmVideo = base64ToUint8Array(contentState.base64);

    setContentState((prevState) => ({
      ...prevState,
      webm: webmVideo,
      ready: true,
    }));

    if (contentState.offline && contentState.ffmpeg === true) {
      // Offline (if I need to do anything differently)
    } else if (
      !contentState.updateChrome &&
      (contentState.duration <= contentState.editLimit || contentState.override)
    ) {
      // Set isFfmpegRunning to true when starting conversion
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

  const getImage = useCallback(async () => {
    if (!contentState.blob) return;
    if (!contentState.ffmpeg) return;
    if (contentState.isFfmpegRunning) return;

    setContentState((prevState) => ({
      ...prevState,
      isFfmpegRunning: true, // Set isFfmpegRunning to true to indicate that ffmpeg is running
    }));

    sendMessage({ type: "get-frame", time: 0, blob: contentState.blob });
  }, [contentState.blob, contentState.ffmpeg, contentState.isFfmpegRunning]);

  const addAudio = async (videoBlob, audioBlob, volume) => {
    if (contentState.isFfmpegRunning) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    const sourceBlob = videoBlob || contentState.blob || contentState.webm;

    setContentState((prev) => ({
      ...prev,
      isFfmpegRunning: true,
      processingProgress: 0,
    }));

    sendMessage({
      type: "add-audio-to-video",
      blob: sourceBlob,
      audio: audioBlob,
      duration: contentState.duration,
      volume: volume,
      replaceAudio: contentState.replaceAudio,
      topLevel: false,
    });
  };

  const handleTrim = async (cut) => {
    if (contentState.isFfmpegRunning) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    const sourceBlob = contentState.blob;

    setContentState((prev) => ({
      ...prev,
      isFfmpegRunning: true,
      processingProgress: 0,
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
    });
  };

  const handleMute = async () => {
    if (contentState.isFfmpegRunning) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    const sourceBlob = contentState.blob;

    setContentState((prev) => ({
      ...prev,
      muting: true,
      isFfmpegRunning: true,
      processingProgress: 0,
    }));

    sendMessage({
      type: "mute-video",
      blob: sourceBlob,
      startTime: contentState.start * contentState.duration,
      endTime: contentState.end * contentState.duration,
      duration: contentState.duration,
      topLevel: false,
    });
  };

  const handleCrop = async (x, y, width, height) => {
    if (contentState.isFfmpegRunning || contentState.cropping) return;
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;

    setContentState((prevState) => ({
      ...prevState,
      cropping: true,
      isFfmpegRunning: true,
      processingProgress: 0,
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
    });

    return true;
  };

  const handleReencode = async (topLevel = false) => {
    if (contentState.isFfmpegRunning) return;

    const sourceBlob = contentState.blob;

    setContentState((prevState) => ({
      ...prevState,
      isFfmpegRunning: true,
      reencoding: true,
      processingProgress: 0, // Reset progress
    }));

    sendMessage({
      type: "reencode-video",
      blob: sourceBlob,
      duration: contentState.duration,
      topLevel,
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
    const rawTitle = contentStateRef.current.title || "Screenity recording";

    const base = sanitizeDownloadFilename(rawTitle);
    const filename = `${base}${ext}`;

    const revoke = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    };

    // Brave fallback: send base64 to background for download
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
        if (chrome.runtime.lastError || !id) {
          reject(chrome.runtime.lastError || new Error("Download failed"));
        } else {
          resolve(id);
        }
      });
    });

    await new Promise((resolve) => {
      const handler = async (delta) => {
        if (delta.id !== downloadId || !delta.state) return;

        const done = () => {
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

  const download = async () => {
    if (contentState.isFfmpegRunning || contentState.downloading) return;

    setContentState((prev) => ({
      ...prev,
      downloading: true,
      isFfmpegRunning: true,
    }));

    try {
      const url = URL.createObjectURL(contentState.blob);
      await requestDownload(url, ".mp4");
      setContentState((prev) => ({ ...prev, saved: true }));
    } catch (err) {
      console.error("MP4 download failed:", err);
    } finally {
      setContentState((prev) => ({
        ...prev,
        downloading: false,
        isFfmpegRunning: false,
      }));
    }
  };

  const downloadWEBM = async () => {
    if (contentState.isFfmpegRunning || contentState.downloadingWEBM) return;

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

    // ➜ ADD THIS: If untouched + already webm → skip FFmpeg entirely
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
    if (contentState.duration > 30) return;

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

  return (
    <ContentStateContext.Provider value={[contentState, setContentState]}>
      {props.children}
    </ContentStateContext.Provider>
  );
};

export default ContentState;
