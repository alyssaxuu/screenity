// Background-side writers for the adaptive policy's device history (T8).
// Fire-and-forget, never throw, and no-op unless the server flag is on and fresh.
// Tests: tests/unit/adaptiveHistoryWriters.test.mjs
import {
  policyFlagsFromStorage,
  recordTakeStart,
  recordTakeEvent,
} from "../../CloudRecorder/adaptivePolicyStore.js";

const FLAG_KEYS = ["adaptivePolicy", "adaptivePolicyAt"];

const flagOn = async (storage) => {
  try {
    const got = await storage.get(FLAG_KEYS);
    return policyFlagsFromStorage(got).adaptivePolicy === true;
  } catch {
    return false;
  }
};

const storageArea = () => globalThis.chrome?.storage?.local || null;

// The take this worker started last. Events carry its id, so one that arrives
// after the next take began cannot land on the newer take. Lost on a worker
// restart, then the event goes to the newest take.
let currentTakeId = null;

export const noteTakeStart = async (id) => {
  try {
    currentTakeId = id || null;
    const storage = storageArea();
    if (!storage || !(await flagOn(storage))) return;
    await recordTakeStart(storage, id);
  } catch {}
};

// flags: { hostLost, startFail, micEnded, micEndedUnderLoad, heavyLoad }
export const noteTakeEvent = async (flags, id = currentTakeId) => {
  try {
    const storage = storageArea();
    if (!storage || !(await flagOn(storage))) return;
    await recordTakeEvent(storage, flags, id);
  } catch {}
};
