const audioUrl = chrome.runtime.getURL("assets/sounds/beep.mp3");
let audioEl = null;

const getAudio = () => {
  if (!audioEl) {
    audioEl = new Audio(audioUrl);
    audioEl.volume = 0.5;
  }
  return audioEl;
};

const playBeep = () => {
  const audio = getAudio();
  try {
    audio.currentTime = 0;
  } catch {}
  const playPromise = audio.play();
  if (playPromise?.catch) {
    playPromise.catch(() => {});
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "play-beep-offscreen") {
    playBeep();
    if (sendResponse) sendResponse({ ok: true });
    return true;
  }
  return false;
});
