// The store and offer clears a dismiss runs. A refused start recorded nothing, so the dismiss
// after it must not touch what the refusal protected: an IDB mic store an unpaid marker points
// at holds the only copy, and only the held page's Discard clears it.
export const runDismissStoreClears = async ({
  refusedStart = false,
  audioBackend,
  hasUnpaidIdbMic,
  clearAudio,
  clearCamera,
  clearOffer,
}) => {
  if (refusedStart) return { cleared: false, reason: "refused-start" };
  let audioKept = false;
  if (audioBackend === "idb") {
    try {
      audioKept = Boolean(await hasUnpaidIdbMic());
    } catch {
      audioKept = true;
    }
  }
  if (!audioKept) await clearAudio();
  await clearCamera();
  await clearOffer();
  return { cleared: true, audioKept };
};
