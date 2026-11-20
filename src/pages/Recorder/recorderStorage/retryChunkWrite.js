// An IndexedDB put that fails on quota can succeed a moment later (eviction or
// another tab's write still settling). The put is keyed by chunk index, so a
// retry never duplicates bytes. OPFS appends to one file, so it never retries.
export const QUOTA_RETRY_DELAYS_MS = [250, 1000, 3000];

export const looksLikeQuotaError = (err) => {
  const name = err?.name || err?.errorName || "";
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    name === "QuotaExceededError" || msg.includes("quota") || msg.includes("disk")
  );
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const writeWithQuotaRetry = async (
  write,
  { delaysMs = QUOTA_RETRY_DELAYS_MS, sleep = wait, onRetry = null } = {},
) => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await write();
    } catch (err) {
      if (!looksLikeQuotaError(err) || attempt >= delaysMs.length) throw err;
      try {
        onRetry?.({ attempt: attempt + 1, err });
      } catch {}
      await sleep(delaysMs[attempt]);
    }
  }
};
