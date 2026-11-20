// The offscreen document as a host: it records nothing itself, it holds one frame per take. Chrome
// allows one offscreen document, so replacing it would end a finishing take; adding a frame does not.
// Each frame is its own realm, so takes share no recorder state.

export const takeFrameUrl = ({ takeId, cloud }) =>
  `offscreenrecorder.html?${cloud ? "cloud=1&" : ""}take=${encodeURIComponent(
    takeId
  )}`;

export const createRecorderHost = ({
  doc = document,
  win = window,
  runtime = chrome.runtime,
} = {}) => {
  const frames = new Map();
  const registry = {
    activeTakeId: null,
    takes: () => [...frames.keys()],
  };
  win.__recorderHost = registry;

  const notifyClosed = (takeId) => {
    runtime
      .sendMessage({
        type: "recorder-host-take-closed",
        takeId,
        remaining: frames.size,
      })
      .catch?.(() => {});
  };

  const removeTake = (takeId) => {
    const frame = frames.get(takeId);
    if (!frame) return false;
    frames.delete(takeId);
    if (registry.activeTakeId === takeId) registry.activeTakeId = null;
    try {
      frame.remove();
    } catch {}
    return true;
  };

  const addTake = ({ takeId, cloud }) => {
    if (!takeId) return { ok: false, error: "missing-take-id" };
    // Set before the frame exists: the SW's "loaded" for this take can reach
    // the older frames first, and they read this to ignore it.
    registry.activeTakeId = takeId;
    if (frames.has(takeId)) return { ok: true, existed: true };
    const frame = doc.createElement("iframe");
    frame.setAttribute(
      "allow",
      "microphone; camera; display-capture; autoplay"
    );
    frame.dataset.takeId = takeId;
    frame.src = takeFrameUrl({ takeId, cloud });
    frames.set(takeId, frame);
    doc.body.appendChild(frame);
    return { ok: true, existed: false };
  };

  const state = () => ({
    ok: true,
    activeTakeId: registry.activeTakeId,
    takes: [...frames.keys()],
  });

  win.addEventListener("message", (e) => {
    const data = e?.data;
    if (data?.type !== "take-frame-close" || !data.takeId) return;
    const frame = frames.get(data.takeId);
    if (!frame || (e.source && frame.contentWindow !== e.source)) return;
    if (removeTake(data.takeId)) notifyClosed(data.takeId);
  });

  runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg?.type) {
      case "recorder-host-add-take":
        sendResponse(addTake(msg));
        return false;
      case "recorder-host-remove-take":
        removeTake(msg.takeId);
        sendResponse(state());
        return false;
      case "recorder-host-clear-active":
        // The next take records outside the host (tab, custom region).
        registry.activeTakeId = null;
        sendResponse(state());
        return false;
      case "recorder-host-state":
        sendResponse(state());
        return false;
      default:
        return false;
    }
  });

  return { addTake, removeTake, state, registry };
};
