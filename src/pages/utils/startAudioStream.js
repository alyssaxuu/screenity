// Microphone acquisition shared by CloudRecorder, Recorder, Region.
// getUserMediaWithFallback re-resolves the device by label if the id drifted; falls
// back to generic getUserMedia({audio:true}) before giving up with null.
// Per-page options:
//   bailOnNone:     return null for a "none"/empty id (Recorder)
//   bluetoothDiag:  diag-forward when the mic comes up at a low sample rate (Recorder)
//   toastOnBlocked: toast when even the generic fallback fails (CloudRecorder)
//   separatedMic:   the mic is its own file, so ask Chrome to skip noise suppression and AGC
//   logger:         optional { debug, warn } for dev breadcrumbs
import { getUserMediaWithFallback } from "./mediaDeviceFallback";

// Chrome's noise-suppression and AGC stage runs ahead of us and can chop speech,
// so both are off for a separated mic. Echo cancellation stays on: on speakers
// the mic file would otherwise carry the demo audio. The combined path keeps
// the defaults.
export const RAW_MIC_PROCESSING = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: false,
};

// FNV-1a: enough to tell two devices apart in telemetry without shipping the id.
const hashId = (id) => {
  let h = 0x811c9dc5;
  const str = String(id || "");
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

// What Chrome applied, read back from the track. constraintsHonored is false
// when any setting differs from the request.
export const describeMicSettings = (stream, requested = null) => {
  const track = stream?.getAudioTracks?.()[0];
  if (!track) return null;
  const s = track.getSettings?.() || {};
  const out = {
    sampleRate: s.sampleRate ?? null,
    channelCount: s.channelCount ?? null,
    deviceIdHash: s.deviceId ? hashId(s.deviceId) : null,
    label: String(track.label || "").slice(0, 60) || null,
    autoGainControl: s.autoGainControl ?? null,
    echoCancellation: s.echoCancellation ?? null,
    noiseSuppression: s.noiseSuppression ?? null,
  };
  if (requested) {
    out.constraintsHonored = Object.keys(requested).every(
      (key) => s[key] === requested[key],
    );
  }
  return out;
};

export async function startAudioStream(
  id,
  {
    bailOnNone = false,
    bluetoothDiag = false,
    toastOnBlocked = false,
    separatedMic = false,
    logger = null,
  } = {},
) {
  logger?.debug?.("startAudioStream()", { id });

  // "none" sentinel: bail before getUserMedia grabs the default mic (Recorder only).
  if (bailOnNone && (!id || id === "none")) {
    logger?.debug?.("startAudioStream() skipped: no audio input selected");
    return null;
  }

  const useExact = id && id !== "none";
  const processing = separatedMic ? RAW_MIC_PROCESSING : null;
  const audioStreamOptions = {
    mimeType: "video/webm;codecs=vp8,opus",
    audio: useExact
      ? { deviceId: { exact: id }, ...processing }
      : processing || true,
  };

  const { defaultAudioInputLabel, audioinput } = await chrome.storage.local.get([
    "defaultAudioInputLabel",
    "audioinput",
  ]);
  const desiredLabel =
    defaultAudioInputLabel ||
    audioinput?.find((device) => device.deviceId === id)?.label ||
    "";

  try {
    const stream = await getUserMediaWithFallback({
      constraints: audioStreamOptions,
      fallbacks:
        useExact && desiredLabel
          ? [
              {
                kind: "audioinput",
                desiredDeviceId: id,
                desiredLabel,
                onResolved: (resolvedId) => {
                  chrome.storage.local.set({
                    defaultAudioInput: resolvedId,
                    defaultAudioInputLabel: desiredLabel,
                  });
                },
              },
            ]
          : [],
    });

    if (separatedMic && stream) {
      const applied = describeMicSettings(stream, RAW_MIC_PROCESSING);
      const honored = applied?.constraintsHonored;
      (honored ? console.info : console.warn)(
        honored
          ? "[startAudioStream] separated mic applied"
          : "[startAudioStream] Chrome kept mic processing on despite the request",
        applied,
      );
    }

    if (bluetoothDiag && stream) {
      // BT mic switches A2DP (48k) to HFP (8/16k mono); the 48k AudioContext then upsamples garbage.
      try {
        const aTrack = stream.getAudioTracks?.()[0];
        const trackSampleRate = Number(aTrack?.getSettings?.()?.sampleRate) || null;
        if (trackSampleRate && trackSampleRate <= 24000) {
          const label = String(aTrack?.label || "").slice(0, 80);
          console.warn(
            "[recorder] mic acquired at low sample rate; likely Bluetooth HFP profile",
            { trackSampleRate, label },
          );
          try {
            chrome.runtime.sendMessage({
              type: "diag-forward",
              event: "recorder-low-sample-rate-mic",
              data: { trackSampleRate, label },
            });
          } catch {}
        }
      } catch {}
    }

    return stream;
  } catch (err) {
    logger?.warn?.("startAudioStream() exact device failed, retrying generic", err);
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: processing || true,
      });
    } catch (err2) {
      logger?.warn?.("startAudioStream() failed completely", err2);
      if (toastOnBlocked) {
        try {
          chrome.runtime.sendMessage({
            type: "show-toast",
            message: "Microphone permission is blocked. Recording will be silent.",
          });
        } catch {}
      }
      return null;
    }
  }
}
