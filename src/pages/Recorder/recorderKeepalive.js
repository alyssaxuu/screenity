// Keep-alive bootstrap. Loaded from recorder.html before the main
// bundle. Region recordings open the tab with active:false so Chrome
// throttles JS within ~1s and bundle parse stretches from 300ms to
// 3-4.5s. Audio oscillator + navigator.locks + mediaSession make the
// tab look active before throttling. Handles on window.__SCREENITY_KEEPALIVE
// so React's startTabKeepAlive() reuses them.
(function () {
  try {
    var KA = (window.__SCREENITY_KEEPALIVE =
      window.__SCREENITY_KEEPALIVE || {});
    KA.startedAt = Date.now();
    try {
      performance.mark("screenity-keepalive-start");
    } catch (e) {}

    // Silent ultrasonic sine; counts as "playing audio" to Chrome.
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !KA.audioCtx) {
        var ctx = new Ctx();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 20000;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        // AudioContext starts suspended without a user gesture; without
        // resume() the oscillator emits nothing and Chrome doesn't
        // count it (diag showed 6.5s mid-recording freezes).
        if (ctx.state !== "running") {
          ctx.resume().catch(function () {});
        }
        KA.audioCtx = ctx;
        KA.oscillator = osc;
      }
    } catch (e) {}

    // Hold an exclusive lock; signals "doing work" to Chrome.
    try {
      if (navigator.locks && !KA.lockAbort) {
        var ac = new AbortController();
        KA.lockAbort = ac;
        navigator.locks
          .request(
            "screenity-recorder-keepalive",
            { mode: "exclusive", signal: ac.signal },
            function () {
              return new Promise(function () {});
            },
          )
          .catch(function () {});
      }
    } catch (e) {}

    try {
      if (navigator.mediaSession && !KA.mediaSession) {
        if (typeof window.MediaMetadata === "function") {
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: "Screenity recording",
            artist: "Screenity",
          });
        }
        navigator.mediaSession.playbackState = "playing";
        try {
          navigator.mediaSession.setActionHandler("pause", function () {});
        } catch (e) {}
        KA.mediaSession = true;
      }
    } catch (e) {}

    KA.completedAt = Date.now();
    try {
      performance.mark("screenity-keepalive-end");
    } catch (e) {}
  } catch (e) {}
})();
