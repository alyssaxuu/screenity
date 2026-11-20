// Send until the recorder confirms. `send` must reject when nothing replied,
// so a receiver that never calls sendResponse costs every attempt.
export const pushWithRetry = async (
  send,
  backoffMs,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
) => {
  for (let attempt = 0; attempt < backoffMs.length; attempt += 1) {
    if (backoffMs[attempt] > 0) await sleep(backoffMs[attempt]);
    try {
      await send();
      return { ok: true, attempts: attempt + 1 };
    } catch {
      // recorder not ready yet; retry
    }
  }
  return { ok: false, attempts: backoffMs.length };
};
