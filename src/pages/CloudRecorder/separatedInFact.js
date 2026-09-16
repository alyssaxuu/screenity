// Whether this take's voice actually ended up outside the screen file.
//
// separatedAudio is intent, set before capture and reachable by the
// mid-recording mic toggle. The scene has to describe the outcome: a mic with
// its own recorder that never joined the mix is not in the video, whatever the
// flag reads by then. 4.6.9 shipped takes where the two disagreed.
export const isSeparatedInFact = ({
  separatedAudio = false,
  hasAudioRecorder = false,
  busHasMic = false,
} = {}) => {
  if (separatedAudio) return true;
  return Boolean(hasAudioRecorder) && !busHasMic;
};

// What the scene declares, which is not whether the take was separated. A lost
// mic upload is only honestly muxed-shaped when the screen track has system
// audio; with nothing there it promises a voice that exists nowhere.
// SEPARATE_AUDIO_CONTRACT section (5).
export const shouldDeclareSeparated = ({
  separatedInFact = false,
  micRecorded = false,
  micLanded = false,
  systemAudioOnScreen = false,
} = {}) => {
  // No mic captured means no voice to be anywhere. Intent alone is true of
  // every screen take and would mark all of them separated.
  if (!separatedInFact || !micRecorded) return false;
  return Boolean(micLanded) || !systemAudioOnScreen;
};
