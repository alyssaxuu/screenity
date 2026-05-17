import { getContextRefs } from "../context/CameraContext";
import { setPipMode } from "./uiState";
import { getUserMediaWithFallback } from "../../utils/mediaDeviceFallback";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const getCameraStream = async (
  constraints,
  streamRef,
  videoRef,
  offScreenCanvasRef,
  offScreenCanvasContextRef,
  { onStart = () => {}, onFinish = () => {} } = {},
) => {
  const { setWidth, setHeight, recordingTypeRef } = getContextRefs();

  onStart();

  if (!streamRef) {
    console.warn("⚠️ streamRef is undefined. Creating a new reference.");
    streamRef = { current: new MediaStream() };
  }

  if (!videoRef) {
    console.warn("⚠️ videoRef is undefined. Creating a new reference.");
    videoRef = { current: null };
  }

  if (!offScreenCanvasRef) {
    console.warn(
      "⚠️ offScreenCanvasRef is undefined. Creating a new reference.",
    );
    offScreenCanvasRef = { current: null };
  }

  if (!offScreenCanvasContextRef) {
    console.warn(
      "⚠️ offScreenCanvasContextRef is undefined. Creating a new reference.",
    );
    offScreenCanvasContextRef = { current: null };
  }

  try {
    const desiredVideoId = constraints?.video?.deviceId?.exact || null;
    let desiredVideoLabel = "";

    if (desiredVideoId) {
      const { defaultVideoInputLabel, videoinput, videoInput } =
        await chrome.storage.local.get([
          "defaultVideoInputLabel",
          "videoinput",
          "videoInput",
        ]);
      const storedDevices = Array.isArray(videoinput)
        ? videoinput
        : Array.isArray(videoInput)
        ? videoInput
        : [];
      desiredVideoLabel =
        defaultVideoInputLabel ||
        storedDevices.find((device) => device.deviceId === desiredVideoId)
          ?.label ||
        "";
    }

    const stream = await getUserMediaWithFallback({
      constraints,
      fallbacks:
        desiredVideoId && desiredVideoLabel
          ? [
              {
                kind: "videoinput",
                desiredDeviceId: desiredVideoId,
                desiredLabel: desiredVideoLabel,
                onResolved: (resolvedId) => {
                  chrome.storage.local.set({
                    defaultVideoInput: resolvedId,
                    defaultVideoInputLabel: desiredVideoLabel,
                  });
                },
              },
            ]
          : [],
    });

    streamRef.current = stream;

    const videoTrack = stream.getVideoTracks()[0];
    const { width, height, deviceId, frameRate } = videoTrack.getSettings();

    // Camera track ends mid-recording (unplug, virtual cam crash, OS revoke).
    // Stop the stream and surface via camera-bubble-unavailable; don't tear
    // down the wrapping recording.
    try {
      videoTrack.addEventListener("ended", () => {
        try {
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "camera-bubble-track-ended",
            data: {
              trackLabel: String(videoTrack?.label || "").slice(0, 80),
              readyState: videoTrack?.readyState || null,
            },
          });
        } catch {}
        try {
          stopCameraStream(streamRef, videoRef);
        } catch {}
        try {
          chrome.runtime.sendMessage({
            type: "camera-bubble-unavailable",
            error: "camera-track-ended",
            why: "camera disconnected during recording",
          });
        } catch {}
      });
    } catch {}

    if (setWidth && setHeight) {
      const isCamera = recordingTypeRef?.current === "camera";
      const w = isCamera || width / height < 1 ? "100%" : "auto";
      const h = isCamera || width / height < 1 ? "auto" : "100%";
      setWidth(w);
      setHeight(h);
    } else {
      console.warn("⚠️ setWidth or setHeight not available from context.");
    }

    if (!videoRef.current) {
      console.warn("⏳ videoRef not ready yet. Will poll every 100ms.");
      const maxWaitTime = 5000;
      const startTime = Date.now();

      const intervalId = setInterval(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          clearInterval(intervalId);
        } else if (Date.now() - startTime > maxWaitTime) {
          console.warn("⚠️ Timed out waiting for videoRef.current");
          clearInterval(intervalId);
        }
      }, 100);
      return;
    }

    const video = videoRef.current;
    video.srcObject = stream;

    // Virtual cameras (OBS Virtual Camera, mmhmm, Snap Camera, etc.)
    // trip up the naive `video.onloadedmetadata = ...` pattern in three
    // ways:
    //   1. Sync race: assigning srcObject can fire `loadedmetadata`
    //      synchronously when the stream is already cached/active. By
    //      the time we set `onloadedmetadata`, the event has already
    //      fired and we hang forever.
    //   2. Track muted: virtual cams often start with the video track
    //      `muted=true` (the source app hasn't focused yet); they fire
    //      `unmute` on the track before metadata.
    //   3. Never fires: some virtual cams never fire `loadedmetadata`
    //      until they receive their first real frame, which can take
    //      arbitrarily long if the source app is paused.
    //
    // Check readyState, addEventListener (no clobber), listen on metadata
    // and unmute, cap the wait at 12s so virtual cams don't hang the spinner.
    const VIRTUAL_CAM_LOADED_TIMEOUT_MS = 12000;
    await new Promise((resolve) => {
      let settled = false;
      const finish = async () => {
        if (settled) return;
        settled = true;
        cleanup();
        await video.play().catch((err) => {
          console.error("❌ Error during video.play():", err);
        });
        await new Promise((r) => setTimeout(r, 100));
        const canvas = offScreenCanvasRef?.current;
        if (!canvas) {
          console.warn("⚠️ offScreenCanvasRef.current is null.");
          return resolve();
        }
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const context = canvas.getContext("2d");
        if (!context) {
          console.error("❌ Failed to get 2D context from canvas.");
          return resolve();
        }
        offScreenCanvasContextRef.current = context;
        resolve();
      };

      const onMetadata = () => {
        finish();
      };
      const onUnmute = () => {
        // Track unmuted but readyState may still be 0; re-check in case
        // HAVE_METADATA was already reached.
        if (video.readyState >= 1) finish();
      };
      const cleanup = () => {
        try {
          video.removeEventListener("loadedmetadata", onMetadata);
          video.removeEventListener("loadeddata", onMetadata);
        } catch {}
        try {
          videoTrack?.removeEventListener?.("unmute", onUnmute);
        } catch {}
        if (timeoutId) clearTimeout(timeoutId);
      };

      // Sync race: already past metadata.
      if (video.readyState >= 1 && video.videoWidth > 0) {
        finish();
        return;
      }

      video.addEventListener("loadedmetadata", onMetadata, { once: true });
      video.addEventListener("loadeddata", onMetadata, { once: true });
      try {
        videoTrack?.addEventListener?.("unmute", onUnmute);
      } catch {}

      // Bounded fallback for virtual cams that never deliver metadata.
      // Proceed with default 1280x720; real frames are picked up later.
      const timeoutId = setTimeout(() => {
        if (settled) return;
        console.warn(
          "[Screenity] Camera loadedmetadata timeout (likely virtual camera); proceeding with defaults",
          {
            readyState: video.readyState,
            videoWidth: video.videoWidth,
            trackMuted: videoTrack?.muted,
            trackLabel: videoTrack?.label,
          },
        );
        try {
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "recorder-camera-metadata-timeout",
            data: {
              readyState: video.readyState,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              trackMuted: !!videoTrack?.muted,
              trackLabel: String(videoTrack?.label || "").slice(0, 80),
            },
          });
        } catch {}
        finish();
      }, VIRTUAL_CAM_LOADED_TIMEOUT_MS);
    });

    onFinish();
  } catch (err) {
    console.error("❌ Failed to get camera stream:", err);
    onFinish();
    // Surface to BG only during setup (pendingRecording=true):
    // 1. screen+camera with camera denied during setup; BG must clear
    //    pendingRecording or the next record stalls.
    // 2. tab+camera with bubble failure mid-recording: stay silent;
    //    propagating a recording-error tears down the live recording.
    try {
      const { recording, pendingRecording, recordingType } =
        await chrome.storage.local.get([
          "recording",
          "pendingRecording",
          "recordingType",
        ]);
      const isPermissionDenial =
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError";
      // For camera-only recordings the webcam is the recording, so a
      // setup failure is fatal. For screen/tab/region it's just a PIP
      // bubble; its failure must not tear down the recording.
      const isCameraOnlyRecording = recordingType === "camera";
      // Diag fires regardless of fatality; "clicked record and got nothing"
      // reports need to distinguish permission denials from device-not-found
      // and getUserMedia hangs.
      try {
        chrome.runtime.sendMessage({
          type: "diag-forward",
          event: "recorder-camera-acquire-failed",
          data: {
            errorName: err?.name || null,
            isPermissionDenial,
            duringSetup: pendingRecording === true && recording !== true,
            recordingActive: recording === true,
            cameraOnly: isCameraOnlyRecording,
            message: String(err?.message || err).slice(0, 200),
          },
        });
      } catch {}
      if (
        isCameraOnlyRecording &&
        pendingRecording === true &&
        recording !== true
      ) {
        // Camera-only setup failure: fatal. BG must clear pendingRecording.
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: isPermissionDenial
            ? "camera-permission-denied"
            : "camera-stream-error",
          why: String(err?.message || err),
        });
      } else if (recording === true || pendingRecording === true) {
        // Screen/tab/region recording: the webcam is just a PIP bubble.
        // Don't tear down the recording; surface a non-fatal toast.
        chrome.runtime.sendMessage({
          type: "camera-bubble-unavailable",
          error: isPermissionDenial
            ? "camera-permission-denied"
            : "camera-stream-error",
          why: String(err?.message || err),
        });
      }
    } catch {
      // BG context might be gone (SW asleep).
    }
  }
};

export const stopCameraStream = (streamRef, videoRef) => {
  if (!streamRef?.current) {
    console.warn("⚠️ No active stream to stop.");
    return;
  }

  const stream = streamRef.current;

  stream.getTracks().forEach((track) => track.stop());

  if (videoRef && videoRef.current) {
    videoRef.current.srcObject = null;
  }
};

export const togglePip = (videoRef) => {
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture();
  } else {
    try {
      videoRef.current.requestPictureInPicture().catch(() => {
        setPipMode(false);
        chrome.runtime.sendMessage({ type: "pip-ended" });
      });
    } catch (error) {
      setPipMode(false);
      chrome.runtime.sendMessage({ type: "pip-ended" });
    }
  }
};
export const surfaceHandler = async (request, videoRef) => {
  console.log("Picture in Picture request ready");

  if (
    !videoRef?.requestPictureInPicture &&
    !videoRef?.current?.requestPictureInPicture
  ) {
    setPipMode(false);
    chrome.runtime.sendMessage({ type: "pip-ended" });
    return;
  }

  if (!CLOUD_FEATURES_ENABLED) {
    const shouldEnterPip = request.surface === "monitor";
    if (shouldEnterPip && videoRef.current) {
      try {
        await videoRef.current.requestPictureInPicture();
      } catch (err) {
        console.error("❌ Failed to enter PiP:", err);
        setPipMode(false);
        chrome.runtime.sendMessage({ type: "pip-ended" });
      }
    }
    return;
  }

  // Auth data is passed along with the set-surface message from the background
  // script (setSurface.js) to avoid an async round-trip that would lose the
  // user gesture context required by requestPictureInPicture().
  try {
    const isSubscribed = request.subscribed || false;
    const instantMode = request.instantMode || false;

    const shouldEnterPip =
      (request.surface === "monitor" && (!isSubscribed || instantMode)) ||
      (request.surface !== "monitor" && isSubscribed && !instantMode);

    if (shouldEnterPip && videoRef.current) {
      await videoRef.current.requestPictureInPicture();
    }
  } catch (error) {
    console.error("❌ Failed to enter Picture in Picture:", error);
    setPipMode(false);
    chrome.runtime.sendMessage({ type: "pip-ended" });
  }
};

let _cameraToggleReacquireTimer = null;
export const cameraToggledToolbar = async (request) => {
  if (request.active) {
    // Cancel any pending re-acquire so rapid toolbar toggles don't stack
    // up multiple getCameraStream calls fighting for the same device.
    if (_cameraToggleReacquireTimer) {
      clearTimeout(_cameraToggleReacquireTimer);
    }
    _cameraToggleReacquireTimer = setTimeout(() => {
      _cameraToggleReacquireTimer = null;
      // Pass refs so the prior camera stream actually stops; calling
      // stopCameraStream() with no args is a silent no-op (early return).
      const refs = getContextRefs();
      stopCameraStream(refs.streamRef, refs.videoRef);
      getCameraStream(
        {
          video: {
            deviceId: { exact: request.id },
          },
        },
        refs.streamRef,
        refs.videoRef,
        refs.offScreenCanvasRef,
        refs.offScreenCanvasContextRef,
      );
    }, 2000);
    setPipMode(false);
  }
};
