/*
 * Caller MUST close the writer's sync handle before reading: getFile()
 * returns stale/empty while the sync handle is held.
 */
const MIN_VALID_RECORDING_BYTES = 4096;

export class OpfsChunkReader {
  constructor() {
    this._fileName = null;
  }

  async open(backendRef) {
    const name = backendRef?.fileName;
    if (!name) throw new Error("opfs-chunk-reader-no-filename");
    this._fileName = name;
  }

  async readBlob() {
    if (!this._fileName) throw new Error("opfs-chunk-reader-not-opened");
    const dir = await navigator.storage.getDirectory();
    const handle = await dir.getFileHandle(this._fileName);
    const file = await handle.getFile();
    if (file.size < MIN_VALID_RECORDING_BYTES) {
      const err = new Error(
        `opfs-file-too-small: ${file.size} bytes < ${MIN_VALID_RECORDING_BYTES}`,
      );
      err.code = "opfs-file-too-small";
      throw err;
    }
    const blob = new Blob([file], { type: "video/mp4" });
    return { blob, byteSize: blob.size, chunkCount: 1 };
  }

  async close() {}
}
