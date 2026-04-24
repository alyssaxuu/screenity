// Intentionally a no-op. Local recording state is managed by the background
// via explicit messages (`recording-check force:true` on the recorded tab,
// `hide-popup-recording` on other tabs). An earlier version of this function
// force-cleared local `recording` whenever `tabRecordedID` was set, which
// clobbered `recording-check` after a same-tab navigation.
export const checkRecording = async () => {};
