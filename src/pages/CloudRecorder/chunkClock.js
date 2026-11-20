// Date.now() can step back (NTP, manual change, sleep resume), but a chunk is never a duplicate
// for it: every dataavailable blob is the next slice. The clock only decides lastTimecode.
// Tests: tests/unit/chunkClock.test.mjs

export const advanceTimecode = (last, timestamp) =>
  timestamp > last ? timestamp : last;
