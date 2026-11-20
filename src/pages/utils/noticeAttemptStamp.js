// A take recording in a tab or the region iframe has no frame id for the SW to
// tell its late notices from the next take's. Its attempt id does that: the SW
// holds a notice stamped with an earlier attempt while another take records.
const NOTICE_TYPES = new Set([
  "show-toast",
  "show-audio-warning",
  "finalize-failure",
  "finalize-recovered",
  "reopen-popup-multi",
]);

const INSTALLED = "__noticeAttemptStamp";

export const stampNoticeAttempt = (runtime, getAttemptId) => {
  if (!runtime || runtime[INSTALLED]) return () => {};
  const orig = runtime.sendMessage;
  const stamped = function (...args) {
    const i = typeof args[0] === "string" ? 1 : 0;
    const msg = args[i];
    if (
      msg &&
      typeof msg === "object" &&
      NOTICE_TYPES.has(msg.type) &&
      msg.__attemptId == null
    ) {
      const attemptId = getAttemptId();
      if (attemptId) args[i] = { ...msg, __attemptId: attemptId };
    }
    return orig.apply(this, args);
  };
  runtime.sendMessage = stamped;
  runtime[INSTALLED] = true;
  return () => {
    if (runtime.sendMessage === stamped) runtime.sendMessage = orig;
    delete runtime[INSTALLED];
  };
};

// start-recording-tab reaches every recorder, a finishing one too, and moves its
// attempt ref to the newer take. A stopped take's notices keep its own id until
// this recorder records again.
export const trackNoticeAttempt = (takeAttemptIdRef) => {
  let frozen;
  return {
    get: () => (frozen !== undefined ? frozen : takeAttemptIdRef.current),
    freeze: () => {
      frozen = takeAttemptIdRef.current || null;
    },
    release: () => {
      frozen = undefined;
    },
  };
};
