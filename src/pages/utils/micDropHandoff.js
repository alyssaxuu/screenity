// Drop details that ride along editor-ready -> update-project-ready so the web
// editor can say where the audio ends. Returns {} unless the take was stopped
// by a mic or system-audio drop with a usable time, so normal stops carry no
// fields. Mic: micLostAtMs. System/tab audio: systemAudioLostAtMs.
export const MIC_DROP_STOP_REASON = "audio-track-ended";
export const SYSTEM_AUDIO_DROP_STOP_REASON = "system-audio-track-ended";

export function micDropFields(drop) {
  if (!drop || typeof drop !== "object") return {};
  const reason = drop.stopReason ?? drop.reason;
  if (reason === SYSTEM_AUDIO_DROP_STOP_REASON) {
    const sysMs = drop.systemAudioLostAtMs ?? drop.elapsedMs;
    if (typeof sysMs !== "number" || !Number.isFinite(sysMs) || sysMs < 0) {
      return {};
    }
    return {
      systemAudioLostAtMs: sysMs,
      stopReason: SYSTEM_AUDIO_DROP_STOP_REASON,
    };
  }
  const ms = drop.micLostAtMs ?? drop.elapsedMs;
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return {};
  const extra = {};
  if (Number.isFinite(drop.micBackAtMs) && drop.micBackAtMs >= ms) {
    extra.micBackAtMs = drop.micBackAtMs;
  }
  if (Number.isFinite(drop.micDropCount) && drop.micDropCount > 1) {
    extra.micDropCount = drop.micDropCount;
  }
  // A take that kept recording has no stop reason: only a return time says the
  // mic dropped and came back.
  if (reason !== MIC_DROP_STOP_REASON) {
    return extra.micBackAtMs !== undefined
      ? { micLostAtMs: ms, ...extra }
      : {};
  }
  return { micLostAtMs: ms, stopReason: MIC_DROP_STOP_REASON, ...extra };
}
