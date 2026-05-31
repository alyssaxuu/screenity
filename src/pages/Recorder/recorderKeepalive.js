// Keep-alive bootstrap. Loads pre-bundle to dodge Chrome's background-tab
// throttle on region recordings. Handles hang off window.__SCREENITY_KEEPALIVE.
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

    // Loopback PC with a live video track marks the tab "in a call" so
    // Chrome keeps the renderer at foreground priority. Host-only ICE.
    try {
      if (typeof RTCPeerConnection === "function" && !KA.priorityPc1) {
        var bcanvas = document.createElement("canvas");
        bcanvas.width = 2;
        bcanvas.height = 2;
        var bctx = bcanvas.getContext("2d");
        if (bctx) bctx.fillRect(0, 0, 2, 2);
        // captureStream(0) → no automatic frames; we tick manually so
        // the track stays "live" without burning CPU on capture.
        var bstream = bcanvas.captureStream
          ? bcanvas.captureStream(0)
          : null;
        var btrack = bstream ? bstream.getVideoTracks()[0] : null;
        if (btrack) {
          var pc1 = new RTCPeerConnection();
          var pc2 = new RTCPeerConnection();
          KA.priorityPc1 = pc1;
          KA.priorityPc2 = pc2;
          KA.priorityCanvas = bcanvas;
          KA.priorityTrack = btrack;
          pc1.onicecandidate = function (e) {
            if (e.candidate) pc2.addIceCandidate(e.candidate).catch(function () {});
          };
          pc2.onicecandidate = function (e) {
            if (e.candidate) pc1.addIceCandidate(e.candidate).catch(function () {});
          };
          pc1.addTrack(btrack, bstream);
          pc1
            .createOffer()
            .then(function (offer) {
              return pc1.setLocalDescription(offer).then(function () {
                return pc2.setRemoteDescription(offer);
              });
            })
            .then(function () {
              return pc2.createAnswer();
            })
            .then(function (answer) {
              return pc2.setLocalDescription(answer).then(function () {
                return pc1.setRemoteDescription(answer);
              });
            })
            .catch(function () {});
          // Periodic 1×1 redraw keeps the captureStream track from
          // being marked ended after the first frame is consumed.
          KA.priorityTick = setInterval(function () {
            try {
              if (bctx) {
                bctx.fillStyle = bctx.fillStyle === "#000" ? "#001" : "#000";
                bctx.fillRect(0, 0, 2, 2);
              }
              if (bstream && typeof bstream.getVideoTracks === "function") {
                var t = bstream.getVideoTracks()[0];
                if (t && typeof t.requestFrame === "function") t.requestFrame();
              }
            } catch (e) {}
          }, 2000);
        }
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
