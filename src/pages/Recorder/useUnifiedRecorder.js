/*!
 * Screenity Unified Recorder Backend (WebCodecs + Fallback)
 * Copyright (c) 2025 Serial Labs Ltd.
 *
 * This file is part of Screenity and is licensed under the GNU GPLv3.
 * See the LICENSE file in the project root for details.
 *
 * This module unifies recorder logic for:
 *  - Main recorder (popup/panel)
 *  - Region recorder (iframe capture)
 *  - Tab capture and full desktop capture
 *
 * WebCodecs primary path:
 *  - Better quality
 *  - Lower latency + faster finalization
 *  - Avoids huge memory spikes during long recordings
 *
 * If reused outside Screenity, GPLv3 obligations apply.
 */

// Imports shared through your monorepo structure
import localforage from "localforage";
import { WebCodecsRecorder } from "./webcodecs/WebCodecsRecorder";
import { sendRecordingError, sendStopRecording } from "../messaging";
import { getBitrates } from "../recorderConfig";
import { getResolutionForQuality } from "../recorderConfig";

// === Persistent storage for chunks (indexedDB) ===
const chunksStore = localforage.createInstance({
  name: "chunks",
});

// === Constants ===
const ESTIMATE_INTERVAL_MS = 5000;
const MIN_HEADROOM = 25 * 1024 * 1024; // ~25MB
const MAX_PENDING_BYTES = 8 * 1024 * 1024;

// === Unified Recorder Factory ===
export function useUnifiedRecorder() {
  const recorderRef = {
    recorder: null,
    useWebCodecs: false,
    running: false,
    finishing: false,
    restarting: false,
    savedCount: 0,
    index: 0,
    pendingBytes: 0,
    pendingQueue: [],
    draining: false,
    lastEstimateAt: 0,
    lowStorageAbort: false,
  };

  const estimateStorage = async (size = 0) => {
    const now = performance.now();
    if (now - recorderRef.lastEstimateAt < ESTIMATE_INTERVAL_MS) {
      return !recorderRef.lowStorageAbort;
    }
    recorderRef.lastEstimateAt = now;

    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const remaining = quota - usage;
      return remaining > MIN_HEADROOM + size;
    } catch {
      return !recorderRef.lowStorageAbort;
    }
  };

  const saveChunkDirect = async (blob, ts) => {
    try {
      await chunksStore.setItem(`chunk_${recorderRef.index}`, {
        index: recorderRef.index,
        chunk: blob,
        timestamp: ts,
      });
      recorderRef.index++;
      recorderRef.savedCount++;
      return true;
    } catch (err) {
      console.error("[UnifiedRecorder] saveChunkDirect failed", err);
      return false;
    }
  };

  const handleChunk = async (blob, timestampMs) => {
    const allowed = await estimateStorage(blob.size);
    if (!allowed) {
      abortForLowStorage();
      return;
    }
    await saveChunkDirect(blob, timestampMs ?? 0);
  };

  function abortForLowStorage() {
    recorderRef.lowStorageAbort = true;
    chrome.storage.local.set({
      recording: false,
      restarting: false,
      memoryError: true,
    });
    chrome.runtime.sendMessage({ type: "stop-recording-tab" });
  }

  async function warmUpStream(liveStream) {
    const videoTrack = liveStream.getVideoTracks()[0];
    const audioTrack = liveStream.getAudioTracks()[0];

    if (!videoTrack) throw new Error("No video track present for warm-up");

    // ensure at least one real frame exists
    await new Promise(async (resolve) => {
      const proc = new MediaStreamTrackProcessor({ track: videoTrack });
      const reader = proc.readable.getReader();

      while (true) {
        const { value: frame } = await reader.read();
        if (frame && frame.codedWidth > 0) {
          frame.close();
          reader.releaseLock();
          resolve();
          break;
        }
        frame?.close();
      }
    });

    if (audioTrack) {
      await new Promise(async (resolve) => {
        const proc = new MediaStreamTrackProcessor({ track: audioTrack });
        const reader = proc.readable.getReader();

        while (true) {
          const { value: audio } = await reader.read();
          if (audio && audio.numberOfFrames > 0) {
            audio.close?.();
            reader.releaseLock();
            resolve();
            break;
          }
          audio?.close?.();
        }
      });
    }

    console.log("[UnifiedRecorder] warm-up complete");
  }

  async function start(liveStream) {
    if (!liveStream || recorderRef.running) return false;

    recorderRef.running = true;
    recorderRef.restart = false;
    recorderRef.index = 0;
    recorderRef.savedCount = 0;
    recorderRef.pendingBytes = 0;

    await chunksStore.clear();

    const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);
    const { audioBitsPerSecond, videoBitsPerSecond } =
      getBitrates(qualityValue);

    const vidTrack = liveStream.getVideoTracks()[0];
    if (!vidTrack) {
      sendRecordingError("No video track");
      return false;
    }

    const settings = vidTrack.getSettings();
    const width = settings.width ?? 1920;
    const height = settings.height ?? 1080;

    const { fpsValue } = await chrome.storage.local.get(["fpsValue"]);
    let fps = parseInt(fpsValue);
    if (Number.isNaN(fps)) fps = 30;

    const useWC =
      typeof VideoEncoder !== "undefined" &&
      typeof AudioEncoder !== "undefined" &&
      typeof MediaStreamTrackProcessor !== "undefined";

    // Warm up tracks — ensures first frames exist
    await warmUpStream(liveStream);

    if (useWC) {
      recorderRef.useWebCodecs = true;
      recorderRef.recorder = new WebCodecsRecorder(liveStream, {
        width,
        height,
        fps,
        videoBitrate: videoBitsPerSecond,
        audioBitrate: audioBitsPerSecond,
        onChunk: async (chunk, timestampUs) => {
          const ts = timestampUs ? Math.floor(timestampUs / 1000) : 0;
          const blob = new Blob([chunk], { type: "video/mp4" });
          await handleChunk(blob, ts);
        },
        onFinalized: () => {
          chrome.runtime.sendMessage({ type: "video-ready" });
        },
        onError: (err) => {
          console.error("[UnifiedRecorder][WC] error", err);
          sendRecordingError(String(err));
        },
      });

      const ok = await recorderRef.recorder.start();
      if (!ok) {
        console.warn("[UnifiedRecorder] WC failed — fallback");
        recorderRef.useWebCodecs = false;
        recorderRef.recorder = null;
        return await start(liveStream);
      }
    } else {
      recorderRef.useWebCodecs = false;
      const mime = "video/webm;codecs=vp8,opus";
      const mr = new MediaRecorder(liveStream, {
        mimeType: mime,
        audioBitsPerSecond,
        videoBitsPerSecond,
      });

      mr.ondataavailable = async (e) => {
        if (!e.data || !e.data.size) return;
        await handleChunk(e.data, e.timecode ?? 0);
      };

      mr.onerror = (ev) => {
        sendRecordingError("MediaRecorder error");
      };

      mr.onstop = async () => {
        chrome.runtime.sendMessage({ type: "video-ready" });
      };

      recorderRef.recorder = mr;
      mr.start(1000);
    }

    chrome.storage.local.set({ recording: true, restarting: false });
    return true;
  }

  async function stop(preserveStreams = false) {
    if (!recorderRef.running) return;
    recorderRef.running = false;

    try {
      if (recorderRef.useWebCodecs) {
        await recorderRef.recorder.stop();
      } else {
        recorderRef.recorder.stop();
      }
    } catch {}

    recorderRef.recorder = null;
    chrome.storage.local.set({ recording: false });
    if (!preserveStreams) {
      sendStopRecording();
    }
  }

  function pause() {
    if (!recorderRef.running) return;
    try {
      recorderRef.recorder.pause();
    } catch {}
  }

  function resume() {
    if (!recorderRef.running) return;
    try {
      recorderRef.recorder.resume();
    } catch {}
  }

  async function restart() {
    recorderRef.restarting = true;
    recorderRef.running = false;
    recorderRef.finishing = false;

    if (recorderRef.useWebCodecs) {
      await recorderRef.recorder.cleanup();
    } else {
      try {
        recorderRef.recorder.stop();
      } catch {}
    }

    recorderRef.recorder = null;
    recorderRef.useWebCodecs = false;

    await chunksStore.clear();
    recorderRef.index = 0;
    recorderRef.savedCount = 0;
    recorderRef.pendingQueue = [];
    recorderRef.pendingBytes = 0;
    recorderRef.restarting = false;
    chrome.storage.local.set({ restarting: false });
  }

  return { start, stop, pause, resume, restart };
}
