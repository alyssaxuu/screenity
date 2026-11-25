// A cloud recorder sends its project and media deletes from the recorder page,
// and the background closes that page right after asking for the dismiss; a
// delete torn down with it reached the server with no body. So the background
// asks the recorder whether it is deleting (a recorder that is not stays
// silent) and only on a yes holds the teardown until the deletes have left the
// page. A take already stopped to be saved says so and is left alone.
export const DISMISS_PROGRESS_TYPE = "dismiss-recording-progress";
export const DISMISS_STATUS_TYPE = "dismiss-recording-status";

// The recorder answers synchronously; this covers a receiver that keeps the
// channel open without answering.
export const DISMISS_STATUS_WAIT_MS = 1000;
// Stopping capture and sending the requests is local work; the server's answer
// is never waited on. Past this the teardown goes ahead.
export const DISMISS_DONE_WAIT_MS = 5000;

export const newDismissId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Listen before the dismiss is sent, so a fast "done" is not missed.
export const listenForDismissDone = ({
  dismissId,
  doneMs = DISMISS_DONE_WAIT_MS,
  runtime = chrome.runtime,
}) => {
  let finish = () => {};
  const promise = new Promise((resolve) => {
    const listener = (msg) => {
      if (msg?.type !== DISMISS_PROGRESS_TYPE || msg.dismissId !== dismissId) {
        return;
      }
      if (msg.phase === "done") finish({ done: true, timedOut: false });
    };
    const timer = setTimeout(
      () => finish({ done: false, timedOut: true }),
      doneMs
    );
    finish = (result) => {
      clearTimeout(timer);
      try {
        runtime.onMessage.removeListener(listener);
      } catch {}
      finish = () => {};
      resolve(result);
    };
    runtime.onMessage.addListener(listener);
  });
  return {
    promise,
    cancel: (why = "cancelled") => finish({ done: false, timedOut: false, why }),
  };
};

// deleting: the recorder still has deletes to send. saving: the take this
// discard owns was stopped to be saved and is still finishing. No answer, an
// error or a late answer is neither (not provably saving).
export const askRecorderDismissStatus = async ({
  dismissId,
  attemptId = null,
  send,
  waitMs = DISMISS_STATUS_WAIT_MS,
}) => {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), waitMs);
  });
  try {
    const answer = await Promise.race([
      Promise.resolve()
        .then(() => send({ type: DISMISS_STATUS_TYPE, dismissId, attemptId }))
        .catch(() => null),
      timeout,
    ]);
    return {
      deleting: answer?.deleting === true,
      saving: answer?.saving === true,
    };
  } finally {
    clearTimeout(timer);
  }
};
