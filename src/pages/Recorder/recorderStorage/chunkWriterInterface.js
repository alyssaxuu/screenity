// ChunkWriter interface for WebCodecs/fMP4 recording.
// implementations: IdbChunkWriter (localforage/IDB fallback) and
// OpfsChunkWriter (worker with FileSystemSyncAccessHandle).
// single-use: one open() per recording, order kept by chunk.index.
// ChunkRecord: { chunk: Blob, index: number, timestamp: number }
// CloseResult: { byteSize, chunkCount, backendRef? }
export const ChunkWriterInterface = {
  async open(recordingId) {},
  async write(record) {},
  async close() {},
  async abort() {},
};
