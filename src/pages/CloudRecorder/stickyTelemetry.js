// Compact view of the WebCodecs sticky-disable for upload events: the error
// string and a few numbers, never the full details object.
export const stickyTelemetryFields = (details) => {
  if (!details || typeof details !== "object") return {};
  const d = details.detail && typeof details.detail === "object" ? details.detail : null;
  const out = {};
  if (typeof details.error === "string" && details.error) {
    out.encoderStickyError = details.error.slice(0, 200);
  }
  const detail = {
    track: typeof details.track === "string" ? details.track : undefined,
    hiddenDuringTake:
      typeof details.hiddenDuringTake === "boolean" ? details.hiddenDuringTake : undefined,
    framesEncoded: d?.framesEncoded,
    framesFromMSTP: d?.framesFromMSTP,
    firstChunkSeen: d?.firstChunkSeen,
    droppedVideo: d?.droppedForBackpressure?.video,
    peakQueueVideo: d?.peakEncodeQueueSize?.video,
  };
  for (const k of Object.keys(detail)) if (detail[k] === undefined) delete detail[k];
  if (Object.keys(detail).length) out.encoderStickyDetail = detail;
  return out;
};
