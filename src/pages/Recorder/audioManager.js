// Audio management for screen recording
export class AudioManager {
  constructor() {
    this.aCtx = null;
    this.destination = null;
    this.audioInputSource = null;
    this.audioOutputSource = null;
    this.audioInputGain = null;
    this.audioOutputGain = null;
    this.helperAudioStream = null;
  }

  async initialize() {
    this.aCtx = new AudioContext();
    this.destination = this.aCtx.createMediaStreamDestination();
    return this.destination;
  }

  async startAudioStream(id) {
    const audioStreamOptions = {
      mimeType: "video/webm;codecs=vp8,opus",
      audio: {
        deviceId: {
          exact: id,
        },
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        audioStreamOptions
      );
      return stream;
    } catch (err) {
      // Try again without the device ID
      const fallbackOptions = {
        mimeType: "video/webm;codecs=vp8,opus",
        audio: true,
      };

      try {
        return await navigator.mediaDevices.getUserMedia(fallbackOptions);
      } catch (err) {
        return null;
      }
    }
  }

  setupAudioNodes(micStream, videoStream) {
    // Set up microphone audio if available
    if (micStream && micStream.getAudioTracks().length > 0) {
      this.helperAudioStream = micStream;
      this.audioInputGain = this.aCtx.createGain();
      this.audioInputSource = this.aCtx.createMediaStreamSource(micStream);
      this.audioInputSource
        .connect(this.audioInputGain)
        .connect(this.destination);
    }

    // Set up system audio if available
    if (videoStream && videoStream.getAudioTracks().length > 0) {
      this.audioOutputGain = this.aCtx.createGain();
      this.audioOutputSource = this.aCtx.createMediaStreamSource(videoStream);
      this.audioOutputSource
        .connect(this.audioOutputGain)
        .connect(this.destination);
    }

    return this.destination.stream;
  }

  setInputVolume(volume) {
    if (this.audioInputGain) {
      this.audioInputGain.gain.value = volume;
    }
  }

  setOutputVolume(volume) {
    if (this.audioOutputGain) {
      this.audioOutputGain.gain.value = volume;
    }
  }

  cleanup() {
    if (this.helperAudioStream) {
      this.helperAudioStream.getTracks().forEach((track) => track.stop());
      this.helperAudioStream = null;
    }

    if (this.aCtx) {
      this.aCtx.close();
      this.aCtx = null;
    }

    this.destination = null;
    this.audioInputSource = null;
    this.audioOutputSource = null;
    this.audioInputGain = null;
    this.audioOutputGain = null;
  }
}
