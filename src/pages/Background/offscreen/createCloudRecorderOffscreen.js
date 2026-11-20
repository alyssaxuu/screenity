import { addRecorderTake, newTakeId } from "./recorderHost";
// Offscreen host for the recorder; immune to background-tab freeze/discard.
// Each take gets its own frame in the one offscreen document Chrome allows (?cloud=1 renders
// <CloudRecorder/>, else <Recorder/>), so starting a take never closes a finishing one.
export const createCloudRecorderOffscreen = async ({ cloud = true } = {}) => {
  const takeId = newTakeId();
  await addRecorderTake({ takeId, cloud });
  return { takeId };
};
