/*
 * Wraps a FileSystemSyncAccessHandle as a WritableStream, so mediabunny's
 * StreamTarget can write to OPFS directly. Keeps zero bytes in memory past
 * the last write. Supports positioned writes (required for fastStart: false
 * MP4, which patches the mdat size header after samples are written).
 *
 * Must run inside a Dedicated Worker: createSyncAccessHandle() is not
 * available on the main thread.
 */
export function createOpfsWritable(syncHandle) {
  let writtenBytes = 0;
  return new WritableStream({
    write(chunk) {
      // Mediabunny's StreamTarget emits chunks shaped as
      // { data: Uint8Array | ArrayBuffer, position: number, type: string }.
      // Fall back to append-mode for plain bytes so the writable is also
      // usable outside StreamTarget.
      const data = chunk?.data ?? chunk;
      const position = chunk?.position ?? writtenBytes;
      const buf =
        data instanceof Uint8Array
          ? data
          : new Uint8Array(data);
      const bytesWritten = syncHandle.write(buf, { at: position });
      const end = position + (bytesWritten ?? buf.byteLength);
      if (end > writtenBytes) writtenBytes = end;
    },
    close() {
      syncHandle.flush();
    },
    abort() {
      syncHandle.flush();
    },
  });
}
