// What the server says of a finalized upload, and the schedule a take waits on before it is held.
// No imports: the recorder, the resume pass and the unit tests load this without the offscreen module graph.

const API_BASE = process.env.SCREENITY_API_BASE_URL;

// Bunny video status: 3 finished, 4 playable, 7 resolution-finished. 5 and 6
// are failures. Anything else is still transcoding or queued.
export const CONFIRMED_VIDEO_STATUSES = new Set([3, 4, 7]);
export const REJECTED_VIDEO_STATUSES = new Set([5, 6]);

// Minutes between checks of a take waiting on Bunny: check k runs SCHEDULE[k - 1] minutes after the
// previous. Five unconfirmed checks hold the take as "unconfirmed" about 38 minutes after it finished.
export const CONFIRM_SCHEDULE_MINUTES = [1, 2, 5, 10, 20];
export const MAX_CONFIRM_CHECKS = 5;
// A take still waiting this long after it finished is held with a plain write,
// even when nobody can reach the server to ask.
export const AWAITING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const confirmDelayMs = (checks = 0) => {
  const i = Math.min(Math.max(Number(checks) || 0, 0), CONFIRM_SCHEDULE_MINUTES.length - 1);
  return CONFIRM_SCHEDULE_MINUTES[i] * 60 * 1000;
};

// Asks the server what Bunny says of a finalized upload. Only a clear answer counts: a 401 (also what
// missing media answers), a 5xx or a dropped connection says nothing and is retried.
export const fetchVideoStatus = async (videoId) => {
  if (!API_BASE || !videoId) return { transient: true };
  try {
    const { screenityToken } = await chrome.storage.local.get(["screenityToken"]);
    const res = await fetch(
      `${API_BASE}/bunny/video-status?videoId=${encodeURIComponent(videoId)}`,
      {
        headers: screenityToken ? { Authorization: `Bearer ${screenityToken}` } : {},
        cache: "no-store",
      }
    );
    if (res.status === 403 || res.status === 404) return { rejected: true };
    if (!res.ok) return { transient: true };
    const body = await res.json().catch(() => null);
    const status = Number(body?.status);
    if (!body || body.status == null || !Number.isFinite(status)) {
      return { transient: true };
    }
    if (CONFIRMED_VIDEO_STATUSES.has(status)) return { confirmed: true, status };
    if (REJECTED_VIDEO_STATUSES.has(status)) return { rejected: true, status };
    return { unfinished: true, status };
  } catch {
    return { transient: true };
  }
};

// One track's verdict. `receipt` is the completed journal its upload left, `ownEnd` where the
// local copy stops. { state }: "confirmed", "short" (upload holds fewer bytes than the disk),
// "no-video", "rejected", "unfinished", "transient".
// The checks that need no network: a failing one is a hold whatever the time.
export const localVerdict = ({ receipt, ownEnd = 0 }) => {
  if (Number(receipt?.finalizedBytes || 0) < Number(ownEnd || 0)) return { state: "short" };
  if (!receipt?.videoId) return { state: "no-video" };
  return null;
};

export const confirmTrack = async ({ receipt, ownEnd = 0 }) => {
  const local = localVerdict({ receipt, ownEnd });
  if (local) return local;
  const v = await fetchVideoStatus(receipt.videoId);
  const bunnyStatus = Number.isFinite(v.status) ? v.status : null;
  if (v.confirmed) return { state: "confirmed", bunnyStatus };
  if (v.rejected) return { state: "rejected", bunnyStatus };
  if (v.unfinished) return { state: "unfinished", bunnyStatus };
  return { state: "transient", bunnyStatus };
};

// Whether a finalize status counts as a failed recording for stop diagnostics. A normal finish
// waits for Bunny (awaiting-confirm) and is healthy; a failed take that kept its bytes waits the same way and is not.
export const finalizeStatusIsFailure = (status, awaitingOutcome = null) =>
  status === "awaiting-confirm"
    ? awaitingOutcome === "failed"
    : status !== "completed";
