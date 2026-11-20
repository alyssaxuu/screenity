import { armResumeAfterPark, noteOffscreenClose } from "./hostWatch";

// One offscreen document hosts every recorder take, one frame each. A new take
// adds a frame instead of replacing the document, so a take that is still
// uploading or creating its scene keeps running.
export const HOST_DOC_URL = "offscreenrecorder.html?host=1";
// activeRecorderTakeId while the newest take records outside the host: frames
// still finishing in it are then all earlier takes.
export const NO_HOST_TAKE = "outside-host";

const OFFSCREEN = "OFFSCREEN_DOCUMENT";

export const takeIdFromUrl = (url) => {
  if (typeof url !== "string") return null;
  try {
    return new URL(url).searchParams.get("take");
  } catch {
    const m = url.match(/[?&]take=([^&#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
};

export const isHostDocUrl = (url) =>
  typeof url === "string" && /[?&]host=1(?:&|#|$)/.test(url);

// getContexts lists the document and each of its frames as OFFSCREEN_DOCUMENT.
export const describeOffscreenContexts = (contexts = []) => {
  const offscreen = (contexts || []).filter(
    (c) => c?.contextType === OFFSCREEN
  );
  const top = offscreen.filter((c) => !c.frameId);
  const doc = top[0] || null;
  const host = doc && isHostDocUrl(doc.documentUrl) ? doc : null;
  const frames = host
    ? offscreen
        .filter((c) => c.frameId && takeIdFromUrl(c.documentUrl))
        .map((c) => ({
          documentId: c.documentId || null,
          frameId: c.frameId,
          takeId: takeIdFromUrl(c.documentUrl),
          documentUrl: c.documentUrl,
          cloud: String(c.documentUrl).includes("cloud=1"),
        }))
    : [];
  return { doc, host, frames };
};

export const readOffscreenContexts = async () => {
  try {
    return describeOffscreenContexts(await chrome.runtime.getContexts({}));
  } catch {
    return { doc: null, host: null, frames: [] };
  }
};

export const newTakeId = () =>
  `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Adding, removing and closing run one at a time: a close that saw an empty
// host must not land after a new take's frame was added.
let hostTail = Promise.resolve();
const withHostLock = (fn) => {
  const run = hostTail.then(fn, fn);
  hostTail = run.then(
    () => {},
    () => {}
  );
  return run;
};

const sendToHost = async (msg, { attempts = 20, delayMs = 100 } = {}) => {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await chrome.runtime.sendMessage(msg);
      if (res && res.ok !== undefined) return res;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw lastErr || new Error("recorder host did not answer");
};

export const readHostState = async () => {
  try {
    return await sendToHost({ type: "recorder-host-state" }, { attempts: 1 });
  } catch {
    return null;
  }
};

// Creates the host if none, then adds the take's frame. A document that is not a
// host (resume pass, remux, an older build's recorder) is closed first, as before.
const addRecorderTakeUnlocked = async ({ takeId, cloud }) => {
  if (
    !chrome.offscreen ||
    typeof chrome.offscreen.createDocument !== "function"
  ) {
    throw new Error("chrome.offscreen API unavailable");
  }
  // Twice: an emptied host can close (closeHostIfEmpty) between the read below
  // and the add, and then a fresh one is made.
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { doc, host } = await readOffscreenContexts();
    if (doc && !host) {
      try {
        noteOffscreenClose("create-preclose");
        await chrome.offscreen.closeDocument();
      } catch (err) {
        console.warn("[recorderHost] pre-close failed", err);
      }
    }
    if (!host) {
      try {
        await chrome.offscreen.createDocument({
          url: HOST_DOC_URL,
          reasons: ["USER_MEDIA", "DISPLAY_MEDIA", "BLOBS", "WORKERS"],
          justification:
            "Host the screen recorder so a long recording survives background-tab freeze/discard.",
        });
      } catch (err) {
        // Lost a race with another create: use the host that won.
        const again = await readOffscreenContexts();
        if (!again.host) throw err;
      }
    }
    let res = null;
    try {
      res = await sendToHost(
        { type: "recorder-host-add-take", takeId, cloud: Boolean(cloud) },
        { attempts: host ? 5 : 20 }
      );
    } catch (err) {
      lastErr = err;
      continue;
    }
    if (!res?.ok) throw new Error(res?.error || "add-take failed");
    await chrome.storage.local.set({ activeRecorderTakeId: takeId });
    await chrome.storage.local.remove(["claimedOverTakeId"]).catch(() => {});
    return res;
  }
  throw lastErr || new Error("add-take failed");
};

// Removes one take's frame. The document goes only when no take is left in it.
const removeRecorderTakeUnlocked = async (takeId, reason = "remove-take") => {
  let remaining = null;
  try {
    const res = await sendToHost(
      { type: "recorder-host-remove-take", takeId },
      { attempts: 3 }
    );
    remaining = Array.isArray(res?.takes) ? res.takes.length : null;
  } catch {}
  if (remaining === null) {
    const { frames } = await readOffscreenContexts();
    remaining = frames.filter((f) => f.takeId !== takeId).length;
  }
  if (remaining === 0) await closeHostIfEmptyUnlocked(reason);
  return { remaining };
};

const closeHostIfEmptyUnlocked = async (reason = "host-empty") => {
  const { host, frames } = await readOffscreenContexts();
  if (!host || frames.length > 0) return false;
  const state = await readHostState();
  if (state && Array.isArray(state.takes) && state.takes.length > 0)
    return false;
  try {
    noteOffscreenClose(reason);
    await chrome.offscreen.closeDocument();
    return true;
  } catch {
    return false;
  }
};

export const addRecorderTake = (args) =>
  withHostLock(() => addRecorderTakeUnlocked(args));
export const removeRecorderTake = (takeId, reason) =>
  withHostLock(() => removeRecorderTakeUnlocked(takeId, reason));
export const closeHostIfEmpty = (reason) =>
  withHostLock(() => closeHostIfEmptyUnlocked(reason));

// The take a caller means when it names none: the one the SW started last. If its frame is
// gone, the frames left are earlier takes still finishing and none is meant. The newest
// frame only when no take was recorded as started (state lost).
export const pickTargetFrame = ({
  frames,
  activeTakeId,
  takeId,
  documentId,
}) => {
  if (takeId) return frames.find((f) => f.takeId === takeId) || null;
  if (documentId) {
    const byDoc = frames.find((f) => f.documentId === documentId);
    if (byDoc) return byDoc;
  }
  if (activeTakeId)
    return frames.find((f) => f.takeId === activeTakeId) || null;
  return frames.length
    ? frames.reduce((a, b) => (b.frameId > a.frameId ? b : a))
    : null;
};

// Whether the take the SW started last still has a recorder (a lone recorder document, or
// its frame in the host). Earlier takes still finishing do not count.
export const isActiveRecorderAlive = async () => {
  const { doc, host, frames } = await readOffscreenContexts();
  if (!doc) return false;
  if (!host) return true;
  let activeTakeId = null;
  try {
    ({ activeRecorderTakeId: activeTakeId } = await chrome.storage.local.get([
      "activeRecorderTakeId",
    ]));
  } catch {}
  return Boolean(pickTargetFrame({ frames, activeTakeId }));
};

// The next take records in a tab or custom-region frame: no host frame may act
// on its control messages, and no unnamed discard may pick a finishing frame.
export const releaseHostActiveTake = async () => {
  await chrome.storage.local.set({ activeRecorderTakeId: NO_HOST_TAKE });
  await chrome.storage.local.remove(["claimedOverTakeId"]).catch(() => {});
  const { host } = await readOffscreenContexts();
  if (!host) return;
  try {
    await sendToHost({ type: "recorder-host-clear-active" }, { attempts: 5 });
  } catch {}
};

// A new take is starting in the host. Takes still finishing keep their frames; one only
// draining its backlog parks (its journal resumes it after) and its frame goes. Never
// awaited by the start.
export const parkTakesForNextStart = async () => {
  const { host, frames } = await readOffscreenContexts();
  if (!host) return { host: false };
  await Promise.all(
    frames.map(async (f) => {
      let res = null;
      try {
        res = await chrome.runtime.sendMessage({
          type: "park-for-next-take",
          takeId: f.takeId,
        });
      } catch {}
      if (res?.parked) {
        await removeRecorderTake(f.takeId, "parked-next-take");
        // The document stays for the new take, so no disconnect arms this.
        void armResumeAfterPark();
      }
    })
  );
  return { host: true };
};
