// wraps a FileSystemSyncAccessHandle as a WritableStream so mediabunny's
// StreamTarget writes to OPFS directly with zero buffered bytes. supports
// positioned writes (fastStart:false patches the mdat size header after
// samples). worker-only since createSyncAccessHandle isn't on the main thread.
export function createOpfsWritable(syncHandle) {
  let writtenBytes = 0;
  return new WritableStream({
    write(chunk) {
      // Mediabunny StreamTarget emits { data, position, type }; fall back
      // to append-mode for plain bytes so the writable works elsewhere.
      const data = chunk?.data ?? chunk;
      const position = chunk?.position ?? writtenBytes;
      const buf =
        data instanceof Uint8Array
          ? data
          : new Uint8Array(data);
      const bytesWritten = syncHandle.write(buf, { at: position });
      // Short write = OPFS quota hit mid-buffer. Hard error so the caller
      // falls back to the in-sandbox tier instead of silently truncating.
      if (
        typeof bytesWritten === "number" &&
        bytesWritten < buf.byteLength
      ) {
        throw new Error(
          `opfs-write-short:${bytesWritten}/${buf.byteLength}`,
        );
      }
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
