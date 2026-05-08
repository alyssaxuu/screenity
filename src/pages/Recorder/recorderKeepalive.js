// keep-alive bootstrap, loaded from recorder.html before the main bundle.
// region recordings open the tab with active:false, so chrome throttles
// JS within ~1s and stretches bundle parse from ~300ms to 3-4.5s.
// three signals (audio oscillator, navigator.locks, mediaSession) make
// the tab look active before throttling kicks in.
// external because MV3 CSP blocks inline <script>. handles stashed on
// window.__SCREENITY_KEEPALIVE so React-side startTabKeepAlive() reuses.
(function () {
  try {
    var KA = (window.__SCREENITY_KEEPALIVE =
      window.__SCREENITY_KEEPALIVE || {});
    KA.startedAt = Date.now();
    try {
      performance.mark("screenity-keepalive-start");
    } catch (e) {}

    // Silent ultrasonic sine wave; counts as "playing audio" to Chrome's
    // freeze heuristic (looks at AudioContext.state + node wiring).
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
        KA.audioCtx = ctx;
        KA.oscillator = osc;
      }
    } catch (e) {}

    // Holding an exclusive lock signals "doing work".
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

    // Belt + braces with the audio oscillator above.
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
