// Mirrors Sandbox/recorderStorage/idbChunkReader, scoped to the recorder page.
import { idbChunksStore as chunksStore } from "./idbChunkWriter";

export class IdbChunkReader {
  async open(_backendRef) {
    await chunksStore.ready();
  }

  async readBlob() {
    const items = [];
    await chunksStore.iterate((value) => {
      items.push(value);
      return undefined;
    });
    items.sort((a, b) => {
      const dt = (a.timestamp ?? 0) - (b.timestamp ?? 0);
      if (dt !== 0) return dt;
      return (a.index ?? 0) - (b.index ?? 0);
    });
    const parts = items.map((c) =>
      c.chunk instanceof Blob ? c.chunk : new Blob([c.chunk]),
    );
    if (!parts.length) return { blob: null, byteSize: 0, chunkCount: 0 };
    const inferredType = parts[0]?.type || "video/mp4";
    const blob = new Blob(parts, { type: inferredType });
    return { blob, byteSize: blob.size, chunkCount: parts.length };
  }

  async close() {}
}
