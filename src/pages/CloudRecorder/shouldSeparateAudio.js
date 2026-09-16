// Whether the mic is recorded to its own file instead of the screen mix.
// Two exceptions, both of which end in a silent take if they are missed, and
// neither of which any server can undo: by upload time the screen file is
// already encoded without the mic.
//
// app-web reads a Stream-hosted mic as separated on client >= 4.6.9, exact
// only while these two stay the whole list: a third would read as separated
// while muxed, playing the voice twice. Growing it means changing the server
// rule in the same release. Test S5 fails if it grows.
export const shouldSeparateAudio = ({
  recordingType,
  instantMode = false,
} = {}) => {
  // getUserMedia with audio:false, no getDisplayMedia, so there is nothing to
  // separate the mic from.
  if (recordingType === "camera") return false;
  // Instant plays the screen file in a plain <video> on /view, with no scene
  // mixing, so a separated mic is a file that path never loads and the share
  // link is narration-free.
  if (instantMode) return false;
  return true;
};
