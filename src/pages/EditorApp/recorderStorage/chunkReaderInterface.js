// ChunkReader interface. IdbChunkReader iterates chunksStore, OpfsChunkReader
// returns the OPFS file as a Blob; chooseReader picks via backendRef.
// ReadResult: { blob, byteSize, chunkCount }
export const ChunkReaderInterface = {
  async open(backendRef) {},
  async readBlob() {},
  async close() {},
};
