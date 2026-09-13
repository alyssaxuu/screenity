import localforage from "localforage";
import { instanceForSlot, loadActiveSlot } from "../../utils/chunkStores";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

export class IdbChunkReader {
  constructor() {
    this._opened = false;
    this._store = null;
  }

  // backendRef.slot names this editor's own recording. Without it a second
  // editor reads whichever slot is live, which is the newer recording.
  async open(backendRef) {
    const slot = backendRef?.slot || (await loadActiveSlot());
    this._store = instanceForSlot(slot);
    await this._store.ready();
    this._opened = true;
  }

  async readBlob() {
    if (!this._opened) {
      throw new Error("idb-chunk-reader-not-opened");
    }
    const items = [];
    await this._store.iterate((value) => {
      items.push(value);
      return undefined;
    });
    // Tiebreak by index: WebCodecs-path chunks share timestamp; index
    // is the real byte order.
    items.sort((a, b) => {
      const dt = (a.timestamp ?? 0) - (b.timestamp ?? 0);
      if (dt !== 0) return dt;
      return (a.index ?? 0) - (b.index ?? 0);
    });
    const parts = items.map((c) =>
      c.chunk instanceof Blob ? c.chunk : new Blob([c.chunk]),
    );
    const byteSize = parts.reduce((s, p) => s + (p?.size || 0), 0);
    // MediaRecorder tags chunks "video/mp4;codecs=...", but the editor matches
    // blob.type exactly, so a suffixed MP4 misses the fast path. Bare container, like OpfsChunkReader.
    const rawType = (parts[0]?.type || "").toLowerCase();
    const inferredType =
      rawType.includes("webm") || rawType.includes("matroska")
        ? "video/webm"
        : "video/mp4";
    const blob = parts.length
      ? new Blob(parts, { type: inferredType })
      : new Blob([], { type: inferredType });
    return { blob, byteSize, chunkCount: parts.length };
  }

  async close() {
    this._opened = false;
  }
}
