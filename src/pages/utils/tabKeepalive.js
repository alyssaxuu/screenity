// Keep a recorder tab/iframe at foreground renderer priority for the
// duration of a recording, so Chrome doesn't throttle the wall-clock-
// driven encode loop and produce VFR output. Four layers, ordered by
// strength of signal to Chrome's renderer scheduler:
//
//   1. Loopback RTCPeerConnection w/ a live captureStream track
//      — marks the renderer "in a call", strongest priority signal.
//   2. Silent ultrasonic AudioContext oscillator
//      — counts as "playing audio".
//   3. navigator.locks exclusive lock
//      — signals "doing work".
//   4. mediaSession metadata + playbackState:"playing"
//      — third-party signal that something is in progress.
//
// All four are idempotent and best-effort. Callers receive a handle to
// pass back to `stopTabKeepalive`. Recorder.jsx uses a separate IIFE
// (recorderKeepalive.js) for its own historical reasons; this helper
// covers the CloudRecorder + Region iframe paths.

const startLoopbackPriorityBoost = (state) => {
  if (typeof RTCPeerConnection !== "function") return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.fillRect(0, 0, 2, 2);

    const stream = canvas.captureStream ? canvas.captureStream(0) : null;
    const track = stream ? stream.getVideoTracks()[0] : null;
    if (!track) return;

    const pc1 = new RTCPeerConnection();
    const pc2 = new RTCPeerConnection();
    pc1.onicecandidate = (e) => {
      if (e.candidate) pc2.addIceCandidate(e.candidate).catch(() => {});
    };
    pc2.onicecandidate = (e) => {
      if (e.candidate) pc1.addIceCandidate(e.candidate).catch(() => {});
    };
    pc1.addTrack(track, stream);
    pc1
      .createOffer()
      .then((offer) =>
        pc1.setLocalDescription(offer).then(() => pc2.setRemoteDescription(offer)),
      )
      .then(() => pc2.createAnswer())
      .then((answer) =>
        pc2.setLocalDescription(answer).then(() => pc1.setRemoteDescription(answer)),
      )
      .catch(() => {});

    // Periodic redraw + requestFrame keeps the captureStream track from
    // being marked ended after the first frame is consumed.
    const tick = setInterval(() => {
      try {
        if (ctx) {
          ctx.fillStyle = ctx.fillStyle === "#000" ? "#001" : "#000";
          ctx.fillRect(0, 0, 2, 2);
        }
        if (stream && typeof stream.getVideoTracks === "function") {
          const t = stream.getVideoTracks()[0];
          if (t && typeof t.requestFrame === "function") t.requestFrame();
        }
      } catch {}
    }, 2000);

    state.pcTick = tick;
    state.pcTrack = track;
    state.pc1 = pc1;
    state.pc2 = pc2;
  } catch {}
};

const startAudioOscillator = (state) => {
  try {
    const Ctx =
      typeof window !== "undefined"
        ? window.AudioContext || window.webkitAudioContext
        : null;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    // Ultrasonic, near-silent. Chrome still counts it as "playing audio".
    osc.frequency.value = 20000;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    // AudioContext starts suspended without a user gesture; without
    // resume() the oscillator emits nothing and the keepalive doesn't
    // register.
    if (ctx.state !== "running" && typeof ctx.resume === "function") {
      ctx.resume().catch(() => {});
    }
    state.audioCtx = ctx;
    state.oscillator = osc;
  } catch {}
};

const startLock = (state) => {
  try {
    if (typeof navigator === "undefined" || !navigator.locks) return;
    const ac = new AbortController();
    state.lockAbort = ac;
    navigator.locks
      .request(
        "screenity-recorder-keepalive",
        { mode: "exclusive", signal: ac.signal },
        () => new Promise(() => {}),
      )
      .catch(() => {});
  } catch {}
};

const startMediaSession = (state) => {
  try {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;
    if (typeof window.MediaMetadata === "function") {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: "Screenity recording",
        artist: "Screenity",
      });
    }
    navigator.mediaSession.playbackState = "playing";
    try {
      navigator.mediaSession.setActionHandler("pause", () => {});
    } catch {}
    state.mediaSessionActive = true;
  } catch {}
};

export const startTabKeepalive = () => {
  if (typeof window === "undefined") return null;
  const state = {};
  startLoopbackPriorityBoost(state);
  startAudioOscillator(state);
  startLock(state);
  startMediaSession(state);
  return state;
};

export const stopTabKeepalive = (handle) => {
  if (!handle) return;
  try {
    if (handle.pcTick) clearInterval(handle.pcTick);
  } catch {}
  try {
    if (handle.pcTrack) handle.pcTrack.stop();
  } catch {}
  try {
    if (handle.pc1) handle.pc1.close();
  } catch {}
  try {
    if (handle.pc2) handle.pc2.close();
  } catch {}
  try {
    if (handle.oscillator) {
      try { handle.oscillator.stop(); } catch {}
      try { handle.oscillator.disconnect(); } catch {}
    }
  } catch {}
  try {
    if (handle.audioCtx) handle.audioCtx.close();
  } catch {}
  try {
    if (handle.lockAbort) handle.lockAbort.abort();
  } catch {}
  try {
    if (handle.mediaSessionActive && navigator.mediaSession) {
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.metadata = null;
      try {
        navigator.mediaSession.setActionHandler("pause", null);
      } catch {}
    }
  } catch {}
};
