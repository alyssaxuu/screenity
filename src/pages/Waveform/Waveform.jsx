import React, { useEffect, useRef } from "react";

const Waveform = () => {
  const canvasRef = useRef(null);
  let audioContext;
  let analyser;
  let dataArray;
  let animationFrameId;
  let audioStream;

  useEffect(() => {
    const canvas = canvasRef.current;
    const canvasContext = canvas.getContext("2d");

    function initializeAudioContext() {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.maxDecibels = -60;
        dataArray = new Float32Array(analyser.fftSize);
        const source = audioContext.createMediaStreamDestination();
        analyser.connect(source);
        audioContext.resume();
        startVisualization();
      }
    }

    function startVisualization() {
      analyser.getFloatTimeDomainData(dataArray);
      canvasContext.clearRect(0, 0, canvas.width, canvas.height);
      canvasContext.beginPath();
      const sliceWidth = 0.9;
      const waveformHeight = canvas.height;
      const waveformOffset = (canvas.height - waveformHeight) / 2;
      let x = 0;
      let sum = 0;
      let count = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] + 1) / 2;
        sum += v;
        count++;
        if (count === 10) {
          const avg = sum / count;
          const y = avg * waveformHeight * 2 + waveformOffset;
          if (i === 0) {
            canvasContext.moveTo(x, y);
          } else {
            canvasContext.lineTo(x, y);
          }
          x += sliceWidth;
          sum = 0;
          count = 0;
        }
      }
      canvasContext.strokeStyle = "#78C072";
      canvasContext.stroke();

      animationFrameId = requestAnimationFrame(startVisualization);
    }

    function startVisualization() {
      analyser.getFloatTimeDomainData(dataArray);
      canvasContext.clearRect(0, 0, canvas.width, canvas.height);
      canvasContext.beginPath();
      const sliceWidth = 0.7;
      const waveformHeight = canvas.height * 0.9;
      const waveformOffset = (canvas.height - waveformHeight) / 2;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] + 1) / 2;
        const y = v * waveformHeight + waveformOffset;
        if (i === 0) {
          canvasContext.moveTo(x, y);
        } else {
          canvasContext.lineTo(x, y);
        }
        x += sliceWidth;
      }
      canvasContext.strokeStyle = "#78C072";
      canvasContext.lineWidth = 1.5;
      canvasContext.stroke();

      animationFrameId = requestAnimationFrame(startVisualization);
    }

    function stopVisualization() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    }

    function startAudioCapture() {
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .then((stream) => {
          audioStream = stream;
          initializeAudioContext();
          const audioSource = audioContext.createMediaStreamSource(audioStream);
          audioSource.connect(analyser);
        })
        .catch((error) => {
          console.error("Error capturing audio:", error);
        });
    }

    function stopAudioCapture() {
      if (audioStream) {
        const tracks = audioStream.getTracks();
        tracks.forEach((track) => track.stop());
        audioStream = null;
        stopVisualization();
      }
    }

    startAudioCapture();

    return () => {
      stopAudioCapture();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width="324"
      height="30"
      style={{ background: "#f5f6fa" }}
    />
  );
};

export default Waveform;
