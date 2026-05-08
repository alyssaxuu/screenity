// Keep the getDisplayMedia capture pipeline hot while we wait for the user
// (countdown, gate, etc). Without this, macOS lets the capture stream go idle
// after warm-up and the first ~1s of recording is stale frames.

export function startPrewarm(liveStream) {
  const videoTrack = liveStream?.getVideoTracks?.()[0];
  if (!videoTrack || typeof MediaStreamTrackProcessor === "undefined") {
    return null;
  }
  let cancelled = false;
  let processor;
  let reader;
  try {
    processor = new MediaStreamTrackProcessor({ track: videoTrack });
    reader = processor.readable.getReader();
  } catch {
    return null;
  }
  const loop = (async () => {
    try {
      while (!cancelled) {
        const { value, done } = await reader.read();
        if (done) break;
        try {
          value?.close?.();
        } catch {}
      }
    } catch {}
    try {
      reader.releaseLock();
    } catch {}
  })();
  return {
    cancel: async () => {
      cancelled = true;
      try {
        await reader.cancel();
      } catch {}
      try {
        await loop;
      } catch {}
    },
  };
}

export async function stopPrewarm(controller) {
  if (!controller) return;
  try {
    await controller.cancel();
  } catch {}
}
