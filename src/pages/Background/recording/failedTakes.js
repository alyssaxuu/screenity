// Takes whose recorder reported a start failure. A frame of such a take must not get streaming-data
// again: a late push retry or fresh pull would start a capture the SW tore down, hidden behind recording=true.
const failed = new Set();

export const noteTakeFailed = (takeId) => {
  if (!takeId) return;
  failed.add(takeId);
  if (failed.size > 20) failed.delete(failed.values().next().value);
};

export const hasTakeFailed = (takeId) => Boolean(takeId) && failed.has(takeId);
