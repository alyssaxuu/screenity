// ChunkReader interface for the editor.
// IdbChunkReader iterates chunksStore. OpfsChunkReader returns the OPFS
// file as a Blob. SwRelayReader serves the legacy ffmpeg editor (null-
// origin) since it can't reach IDB/OPFS directly.
// chooseReader picks based on backendRef from the writer's close().
// ReadResult: { blob, byteSize, chunkCount }
export const ChunkReaderInterface = {
  async open(backendRef) {},
  async readBlob() {},
  async close() {},
};
