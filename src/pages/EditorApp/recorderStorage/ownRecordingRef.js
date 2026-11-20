// Which recording this editor tab owns. lastRecordingBackendRef only ever names
// the newest recording, so with several editors open it is the wrong answer for
// all but one. The SW's registration for this tab is asked first.
export const resolveOwnRecordingRef = async ({
  ask,
  readShared,
  launchRecordingId = null,
}) => {
  try {
    const owned = await ask();
    if (owned?.ref?.backend) return { ref: owned.ref, source: "owned" };
    // Its bytes were reclaimed: the shared pointer now names another recording.
    if (owned?.gone) return { ref: null, source: "gone" };
  } catch {}
  const shared = (await readShared()) || null;
  if (
    launchRecordingId &&
    shared?.fileName &&
    !String(shared.fileName).includes(launchRecordingId)
  ) {
    return { ref: null, source: "moved" };
  }
  return { ref: shared, source: "shared" };
};

// The IDB reader takes its slot from the ref. With none it follows the active
// pointer, which only an unregistered (single) editor may do.
export const idbRefFor = (ref) => ({ backend: "idb", slot: ref?.slot || null });
