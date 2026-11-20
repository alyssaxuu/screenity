// System or tab audio ended mid-take. Closing the shared tab ends audio and video together, so the
// audio end waits a moment: if video ended too (or the take is stopping), the video-ended path owns
// the stop. Otherwise the take stops and the editor says where the audio ends.

export const SYSTEM_AUDIO_STOP_REASON = "system-audio-track-ended";
export const SYSTEM_AUDIO_END_SETTLE_MS = 500;

// arm() on every audio `ended`; onStop runs at most once per armed window.
// isStale covers user stop, discard, restart and an already-sent stop.
export function createSystemAudioEndGate({
  delayMs = SYSTEM_AUDIO_END_SETTLE_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  isStale,
  isVideoEnded,
  onStop,
  onSkip,
} = {}) {
  let timer = null;
  return {
    arm() {
      if (timer !== null) return;
      timer = setTimer(() => {
        timer = null;
        if (isStale?.()) {
          onSkip?.("stale");
          return;
        }
        if (isVideoEnded?.()) {
          onSkip?.("video-ended");
          return;
        }
        onStop?.();
      }, delayMs);
    },
    cancel() {
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}

export const buildSystemAudioDropEvent = ({ info, ts, elapsedMs }) => ({
  ...info,
  source: "system-audio",
  ts,
  elapsedMs,
  reason: SYSTEM_AUDIO_STOP_REASON,
});

// An earlier mic drop of this take stays so the editor note shows the earlier time. startRecording
// resets lastTrackEndEvent, so any source "mic" event is this take's (a recovered one has no source).
// A mic event without a usable time cannot show a note, so it is replaced.
export const resolveSystemAudioDropEvent = ({ existing, next }) =>
  existing && existing.source === "mic" && Number.isFinite(existing.elapsedMs)
    ? existing
    : next;

// A late mic reconnect must not erase a note after a stop was already sent
// (for example the system-audio stop).
export const shouldWriteMicRecoveredEvent = ({
  ok,
  generation,
  currentGeneration,
  stopSent,
}) => Boolean(ok) && generation === currentGeneration && !stopSent;
