import { useEffect } from "react";

// Loaded as camera.html?meter=1 in the floating window. Listens to the mic only
// and posts a 0 to 1 level to the parent; nothing is recorded.
const MicMeter = () => {
  useEffect(() => {
    let stream = null;
    let context = null;
    let timer = null;
    let cancelled = false;

    const start = async () => {
      try {
        const { defaultAudioInput } = await chrome.storage.local.get([
          "defaultAudioInput",
        ]);
        const audio =
          defaultAudioInput && defaultAudioInput !== "none"
            ? { deviceId: { exact: defaultAudioInput } }
            : true;
        stream = await navigator.mediaDevices.getUserMedia({ audio });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        context = new AudioContext();
        if (context.state === "suspended") await context.resume();
        if (cancelled) return;
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(stream).connect(analyser);
        const data = new Float32Array(analyser.fftSize);
        let smoothed = 0;
        timer = setInterval(() => {
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
          const level = Math.min(1, Math.sqrt(sum / data.length) * 5);
          smoothed = level > smoothed ? level : smoothed * 0.8 + level * 0.2;
          try {
            window.parent.postMessage(
              { type: "screenity-mic-level", level: smoothed },
              "*"
            );
          } catch {}
        }, 70);
      } catch {}
    };
    start();

    return () => {
      cancelled = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
      context?.close().catch(() => {});
    };
  }, []);
  return null;
};

export default MicMeter;
