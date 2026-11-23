// A take records before its uploads exist, so a failed create costs only upload
// latency and is retried while the take is live.
export const CREATE_RETRY_BACKOFF_MS = [2000, 5000, 10000, 20000, 30000];

export const createRetryDelayMs = (attempt) =>
  CREATE_RETRY_BACKOFF_MS[Math.min(attempt, CREATE_RETRY_BACKOFF_MS.length - 1)];

// Returns true on success, false when shouldStop() says the take is over (Stop,
// dismiss) or onFail() returns "give-up".
export const retryCreate = async ({
  create,
  shouldStop,
  wait,
  onFail = () => {},
}) => {
  for (let attempt = 0; ; attempt++) {
    if (shouldStop()) return false;
    try {
      await create();
      return true;
    } catch (err) {
      if (onFail(err, attempt) === "give-up") return false;
      if (shouldStop()) return false;
      await wait(createRetryDelayMs(attempt));
    }
  }
};

// A 4xx other than 408 and 429 is the server refusing this take (400 bad
// request, 401 not owned, 403 quota, 409 conflict). It will not change on retry.
export function isPermanentCreateFailure(err) {
  const s = err?.status;
  return Number.isInteger(s) && s >= 400 && s < 500 && s !== 408 && s !== 429;
}

// Signed out or no token yet. Not a refusal of the take, but before the first
// frame the user can still sign in, so the start fails instead of waiting.
export function isAuthCreateFailure(err) {
  return /^(Not authenticated|Missing user token)/.test(err?.message || "");
}
