export const DEFAULT_MAX_RECORDING_SECONDS = 2 * 60 * 60;

export const recordingLimitSeconds = (
  raw = process.env.MAX_RECORDING_DURATION
) => {
  const n = parseFloat(raw);
  return n > 0 ? n : DEFAULT_MAX_RECORDING_SECONDS;
};

export const recordingLimitMinutes = (raw) =>
  String(Math.round(recordingLimitSeconds(raw) / 60));

// The mic file is chunked to storage, so this is a runaway backstop rather than
// the cap. 32 KB/s is about twice a 128 kbps Opus track.
const AUDIO_BYTES_PER_SECOND = 32 * 1024;
const AUDIO_BUFFER_FLOOR_BYTES = 150 * 1024 * 1024;

export const audioBufferLimitBytes = (limitSeconds = recordingLimitSeconds()) =>
  Math.max(
    AUDIO_BUFFER_FLOOR_BYTES,
    Math.ceil(limitSeconds * AUDIO_BYTES_PER_SECOND)
  );

// The old flat 120 s stays as the floor; past 30 MB a mic file gets 4 s per
// MB, about a 2 Mbps uplink, so a 2 h mic (~86 MB at 96 kbps) gets ~5.5 min.
const MIC_UPLOAD_BUDGET_FLOOR_MS = 120000;
const MIC_UPLOAD_MS_PER_MB = 4000;
const MIC_UPLOAD_BUDGET_CEIL_MS = 10 * 60 * 1000;

// The scene POST waits at most this long for the mic upload, and a file of
// more than 1 MiB cannot land in that time, so it is not waited for at all.
const PRE_SCENE_RACE_MAX_BYTES = 1024 * 1024;
export const skipPreSceneMicRace = (sizeBytes) =>
  (Number(sizeBytes) || 0) > PRE_SCENE_RACE_MAX_BYTES;

export const micUploadBudgetMs = (sizeBytes) => {
  const mb = (Number(sizeBytes) || 0) / (1024 * 1024);
  return Math.min(
    MIC_UPLOAD_BUDGET_CEIL_MS,
    Math.max(MIC_UPLOAD_BUDGET_FLOOR_MS, Math.ceil(mb * MIC_UPLOAD_MS_PER_MB))
  );
};

// How long a micUploadInFlight flag counts as live: the budget the stop path wrote into it plus a
// margin for the scene POST and silence check. An older build's flag has no budget: the old fixed window.
const MIC_UPLOAD_FLAG_MARGIN_MS = 60000;

export const micUploadInFlightTtlMs = (flag, legacyMs) => {
  const budget = Number(flag?.budgetMs);
  if (!(budget > 0)) return legacyMs;
  return Math.max(
    legacyMs,
    Math.min(budget, MIC_UPLOAD_BUDGET_CEIL_MS) + MIC_UPLOAD_FLAG_MARGIN_MS
  );
};
