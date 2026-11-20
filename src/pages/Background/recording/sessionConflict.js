// The SW keeps the registered session in memory, but only the recorder writes
// its status after that. A take that stopped and released its capture is still
// "recording" in memory, so the next take's registration read it as a live
// conflict (tab host: refused) or as stale and wiped the new take's session
// pointer and pending flag (offscreen host). The recorder's per-session key is
// the fresher record.
export const sessionStateKeyFor = (id) => `cloudRecorderSession:${id}`;

export const holdsCapture = (session) =>
  session?.status === "recording" && !(Number(session.captureReleasedAt) > 0);

export const mergeStoredSession = (memory, stored) => {
  if (!memory?.id || !stored || stored.id !== memory.id) return memory;
  const memAt = Number(memory.updatedAt) || 0;
  const storedAt = Number(stored.updatedAt) || 0;
  if (storedAt < memAt) return memory;
  return {
    ...memory,
    status: stored.status ?? memory.status,
    captureReleasedAt:
      stored.captureReleasedAt ?? memory.captureReleasedAt ?? null,
    updatedAt: storedAt || memAt || null,
  };
};

// A conflict clear may only null the stored pointer when it still names the
// session being cleared: the incoming take writes its own pointer first.
export const conflictClearWrites = ({ previousId, storedPointerId }) =>
  previousId && storedPointerId === previousId ? { recorderSession: null } : {};

// Messages a take frame stamps with its id. One from a take that is no longer
// the SW's newest is a finishing take's, and must not act on the recording one.
export const isFromSupersededTake = ({ message, activeTakeId }) =>
  Boolean(
    message?.__takeId && activeTakeId && message.__takeId !== activeTakeId
  );
