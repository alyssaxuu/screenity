// Events that are sent before the take has a mediaId; the server attaches them
// by recordingSessionId instead.
export const DIAG_EVENT_TYPES = new Set([
  "recording_heartbeat",
  "recording_stop_diag",
  "recording_failed_bundle",
  // Fires when a track dies during setup, exactly when its uploader has no
  // meta yet, so the gate would drop it silently.
  "recording_track_setup_failed_after_live",
  // A start refused over another take's held IDB copy runs before the take
  // has media, and has no later event to carry its reason.
  "recording_start_refused",
]);

export const passesTelemetryGate = (event, mediaId) =>
  Boolean(mediaId) || event === "recording_outcome" || DIAG_EVENT_TYPES.has(event);

// Which ids an event is filed under. A start refused over another take's copy runs on a recorder
// page still holding the last take's uploaders, whose mediaId would file the refusal on that take's
// document. So it uses only what the event carries, keyed by its own recording session.
export const resolveTelemetryIds = ({
  event,
  payloadMediaId = null,
  recordingSessionId = null,
  uploaderMediaId = null,
}) => {
  const mediaId =
    event === "recording_start_refused"
      ? payloadMediaId || null
      : payloadMediaId || uploaderMediaId || null;
  return { mediaId, recordingId: mediaId || recordingSessionId || null };
};
