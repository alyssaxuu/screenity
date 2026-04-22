// Background retry queue for incomplete upload journals - resumed silently in an offscreen doc.

const JOURNAL_KEY_PREFIX = "uploadJournal-";
const MAX_RESUME_ATTEMPTS = 5;
const RESUME_LOCK_TTL_MS = 10 * 60 * 1000; // 10 min - stale lock recovery.

const getAllStorage = () =>
  new Promise((resolve) => {
    try {
      chrome.storage.local.get(null, (all) => resolve(all || {}));
    } catch {
      resolve({});
    }
  });

const pickResumeCandidates = (storage) => {
  const pending = [];
  const abandonedKeys = [];
  for (const [key, value] of Object.entries(storage)) {
    if (!key.startsWith(JOURNAL_KEY_PREFIX)) continue;
    if (!value || typeof value !== "object") continue;
    if (value.trackType === "audio") continue; // audio is diagnostic, never uploaded
    if (value.status === "completed") continue;
    if ((value.offset || 0) >= (value.totalBytes || 0)) continue;
    if ((value.resumeAttempts || 0) >= MAX_RESUME_ATTEMPTS) {
      abandonedKeys.push(key);
      continue;
    }
    pending.push(value);
  }
  if (abandonedKeys.length) {
    chrome.storage.local.remove(abandonedKeys).catch(() => {});
  }
  return pending;
};

export const tryResumePendingUploads = async ({
  trigger = "unknown",
} = {}) => {
  try {
    const snap = await chrome.storage.local.get([
      "recording",
      "pendingRecording",
      "resumeInProgress",
      "resumeLockAt",
    ]);
    if (snap.recording || snap.pendingRecording) {
      return { skipped: "recording-active" };
    }
    if (snap.resumeInProgress) {
      const lockAge = Date.now() - (snap.resumeLockAt || 0);
      if (lockAge < RESUME_LOCK_TTL_MS) {
        return { skipped: "resume-in-progress" };
      }
      console.warn("[ResumeUploads] stale lock detected, clearing");
    }

    const all = await getAllStorage();
    const candidates = pickResumeCandidates(all);
    if (!candidates.length) {
      return { skipped: "no-pending-journals" };
    }

    console.log(
      "[ResumeUploads] candidates found:",
      candidates.length,
      "trigger:",
      trigger,
    );

    await chrome.storage.local.set({
      resumeInProgress: true,
      resumeLockAt: Date.now(),
    });

    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
      });
      if (!contexts || contexts.length === 0) {
        await chrome.offscreen.createDocument({
          url: "offscreenrecorder.html?resume=1",
          reasons: ["BLOBS", "USER_MEDIA"],
          justification: "Resuming incomplete TUS uploads",
        });
        await new Promise((r) => setTimeout(r, 300));
      }

      const response = await chrome.runtime
        .sendMessage({
          type: "resume-pending-uploads",
          journals: candidates,
          trigger,
        })
        .catch((err) => ({
          ok: false,
          error: err?.message || String(err),
        }));

      console.log("[ResumeUploads] offscreen response:", response);
      return response || { ok: false };
    } finally {
      await chrome.storage.local.set({
        resumeInProgress: false,
        resumeLockAt: null,
      });
    }
  } catch (err) {
    console.error("[ResumeUploads] unexpected error:", err);
    await chrome.storage.local
      .set({ resumeInProgress: false, resumeLockAt: null })
      .catch(() => {});
    return { ok: false, error: err?.message || String(err) };
  }
};
