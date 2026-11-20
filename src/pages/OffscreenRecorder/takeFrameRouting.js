// The recorder host is one offscreen document with one frame per take, so a finishing take
// (uploads, scene, mic) keeps running while the next records. The SW still broadcasts to every
// frame, so each filters: control messages go to the newest take only, unless the SW names one.

// Messages that drive a capture. A finishing take must never act on the next take's: "loaded"
// would start a second capture in it, "restart" or "dismiss" would delete its project.
export const TAKE_CONTROL_TYPES = new Set([
  "loaded",
  "streaming-data",
  "start-recording-tab",
  "stop-recording-tab",
  "restart-recording-tab",
  "restart-recording",
  "dismiss-recording",
  "pause-recording-tab",
  "resume-recording-tab",
  "set-mic-active-tab",
  "set-audio-output-volume",
  "get-video-time",
  "crop-target",
  "offscreen-shutdown",
  "park-for-next-take",
  "recorder-keepalive-ping",
  "recorder-state-snapshot",
  "recorder-wake-aggressive",
]);

// Messages that start, restart or throw away a capture. A stopped take ignores them unless the SW
// names it: the registry can still point at it between the next Start click and the new frame.
const FINISHED_TAKE_IGNORES = new Set([
  "loaded",
  "start-recording-tab",
  "restart-recording-tab",
  "restart-recording",
  "dismiss-recording",
]);

// Retrying a failed finalize belongs to a take that already stopped. Delivered
// to the recording take it would stop that take.
export const TAKE_LATE_TYPES = new Set([
  "retry-finalize",
  "export-finalize-diagnostics",
]);

// The host document runs the resume pass; a frame running it too would upload
// the same journal twice.
export const HOST_ONLY_TYPES = new Set(["resume-pending-uploads"]);

export const shouldDeliverToTakeFrame = ({
  msg,
  takeId,
  activeTakeId,
  finishing,
  inHost = activeTakeId != null,
}) => {
  const type = msg?.type;
  if (HOST_ONLY_TYPES.has(type)) return false;
  if (msg && msg.takeId != null) return msg.takeId === takeId;
  if (TAKE_LATE_TYPES.has(type)) return finishing === true;
  if (TAKE_CONTROL_TYPES.has(type)) {
    if (finishing === true && FINISHED_TAKE_IGNORES.has(type)) return false;
    // No host registry (frame opened alone): act like a lone document. With no active take (the
    // newest take runs in a tab) none of its frames is the recording one.
    if (!inHost) return true;
    return activeTakeId === takeId;
  }
  return true;
};

// A recorder outside the host (cloudrecorder.html tab, custom-region frame) hears the same
// broadcasts and the SW cannot name it. Once stopped, a capture-starting message is the next take's:
// acking "loaded" here ended the SW's retries before the new frame listened, so that take waited for
// this one to close. Once a newer take claimed its attempt, every capture control is its too
// (Stop included, not the shutdown flush). A message naming a take is for a host frame.
const STOPPED_TAB_IGNORES = new Set([
  "loaded",
  "streaming-data",
  "start-recording-tab",
  "restart-recording-tab",
  "restart-recording",
]);
const SUPERSEDED_TAB_KEEPS = new Set(["offscreen-shutdown"]);

export const shouldDeliverToTabRecorder = ({ msg, stopped, superseded }) => {
  if (msg && msg.takeId != null) return false;
  const type = msg?.type;
  // A retry stops the recorder first, so a take still recording must not hear it.
  if (TAKE_LATE_TYPES.has(type)) return stopped;
  if (!stopped) return true;
  if (STOPPED_TAB_IGNORES.has(type)) return false;
  if (superseded && TAKE_CONTROL_TYPES.has(type)) return SUPERSEDED_TAB_KEEPS.has(type);
  return true;
};

// Runs in a take frame before any recorder module loads.
export const installTakeFrame = ({
  takeId,
  win = window,
  runtime = chrome.runtime,
}) => {
  const state = { takeId, finishing: false };
  win.__takeFrame = state;
  const host = () => {
    try {
      return win.parent && win.parent !== win
        ? win.parent.__recorderHost
        : null;
    } catch {
      return null;
    }
  };

  const onMessage = runtime.onMessage;
  const wrapped = new Map();
  const origAdd = onMessage.addListener.bind(onMessage);
  const origRemove = onMessage.removeListener.bind(onMessage);
  const origHas = onMessage.hasListener?.bind(onMessage);
  onMessage.addListener = (fn) => {
    if (wrapped.has(fn)) return;
    const filtered = (msg, sender, sendResponse) => {
      const registry = host();
      const ok = shouldDeliverToTakeFrame({
        msg,
        takeId,
        activeTakeId: registry?.activeTakeId ?? null,
        finishing: state.finishing,
        inHost: Boolean(registry),
      });
      if (!ok) return false;
      return fn(msg, sender, sendResponse);
    };
    wrapped.set(fn, filtered);
    origAdd(filtered);
  };
  onMessage.removeListener = (fn) => {
    const filtered = wrapped.get(fn);
    if (!filtered) return;
    wrapped.delete(fn);
    origRemove(filtered);
  };
  if (origHas) onMessage.hasListener = (fn) => wrapped.has(fn);

  // Every message out of a take carries its id, so the SW can tell a late
  // message from a finishing take from the recording take's.
  const origSend = runtime.sendMessage.bind(runtime);
  runtime.sendMessage = (...args) => {
    const i = typeof args[0] === "string" ? 1 : 0;
    const msg = args[i];
    if (
      msg &&
      typeof msg === "object" &&
      !Array.isArray(msg) &&
      msg.__takeId == null
    ) {
      args[i] = state.slot
        ? { ...msg, __takeId: takeId, __takeSlot: state.slot }
        : { ...msg, __takeId: takeId };
    }
    return origSend(...args);
  };

  // A frame cannot close itself. The recorder calls window.close() when its take
  // is done, so hand that to the host, which removes the frame.
  win.close = () => {
    try {
      win.parent.postMessage({ type: "take-frame-close", takeId }, "*");
    } catch {}
  };
  return state;
};

// True once a newer take has started (in this host or outside it): a take
// frame's writes to the shared "current take" keys would then land on that take.
export const isSupersededTake = (
  win = typeof window !== "undefined" ? window : null
) => {
  try {
    const own = win?.__takeFrame?.takeId;
    const registry = win?.parent?.__recorderHost;
    return Boolean(own && registry && registry.activeTakeId !== own);
  } catch {
    return false;
  }
};

// Outside the host there is no registry to ask; the attempt id the next click claims says the same.
// Not sticky: a click that never became a start gives the previous id back.
export const isSupersededByAttempt = ({
  finishing,
  ownAttemptId,
  storedAttemptId,
}) =>
  Boolean(
    finishing &&
      ownAttemptId &&
      storedAttemptId &&
      storedAttemptId !== ownAttemptId
  );

export const currentTakeId = (
  win = typeof window !== "undefined" ? window : null
) => win?.__takeFrame?.takeId || null;

// Called by a recorder when its Stop begins: from here it is finishing, and the
// next take's control messages are not its own.
export const markTakeFinishing = (
  win = typeof window !== "undefined" ? window : null
) => {
  if (win && win.__takeFrame) win.__takeFrame.finishing = true;
};

// A second Stop for an already stopping take (the toolbar's message reaches the frame as well as the
// SW's forward) is received, not lost: otherwise the SW sees no answer and says saving is slow.
export const alreadyStoppingStopAck = (
  win = typeof window !== "undefined" ? window : null
) => Boolean(win?.__takeFrame?.finishing);
