// Sort by `index`: WebCodecs stamps timestamp 0 on every chunk, so a timestamp sort is all
// ties and keeps IndexedDB's text key order (chunk_1, chunk_10, chunk_2). Timestamp must never outrank index.
export const orderChunks = (chunks) =>
  chunks.sort((a, b) => {
    const ia = a.index ?? a.timestamp ?? 0;
    const ib = b.index ?? b.timestamp ?? 0;
    return ia - ib;
  });
