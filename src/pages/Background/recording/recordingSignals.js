import { resolveRecordingSignals } from "../../utils/recordingSignals";
import { diagEvent } from "../../utils/diagnosticLog";
import { emitRecordingTelemetry } from "./emitRecordingTelemetry";

// Serialized: the merged record is a storage read/modify/write.
let tail = Promise.resolve();

export const handleRecordingSignals = (message) => {
  tail = tail
    .catch(() => {})
    .then(async () => {
      const store = await chrome.storage.local.get([
        "recordingAttemptId",
        "lastRecordingSignals",
      ]);
      const resolved = resolveRecordingSignals(message, store);
      if (!resolved) return;
      const { attemptId, phase, signals, record } = resolved;
      await chrome.storage.local.set({ lastRecordingSignals: record });
      // Lands only while a diag session is open (stop, mostly); the stored
      // record above is what the support zip reads.
      diagEvent(`signals-${phase}`, signals);
      // Keyed on the attempt id, the doc the start beacon lands on.
      void emitRecordingTelemetry("recording_signals", {
        recordingId: attemptId,
        recordingSessionId: attemptId,
        signals: { ...signals, phase },
      });
    })
    .catch(() => {});
  return tail;
};
