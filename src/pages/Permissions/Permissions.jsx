import React, { useEffect, useState, useRef, useCallback } from "react";

const Recorder = () => {
  useEffect(() => {
    window.parent.postMessage(
      {
        type: "screenity-permissions-loaded",
      },
      "*"
    );

    // Cross-origin iframe, so allowsFeature reflects what the page actually
    // delegated to us. Pages with feature=(self) (e.g. facebook.com) don't
    // delegate, so this reads false. Report up so the UI can warn.
    try {
      const pp = document.permissionsPolicy || document.featurePolicy;
      if (pp && typeof pp.allowsFeature === "function") {
        window.parent.postMessage(
          {
            type: "screenity-site-policy",
            cameraAllowed: pp.allowsFeature("camera"),
            microphoneAllowed: pp.allowsFeature("microphone"),
            displayCaptureAllowed: pp.allowsFeature("display-capture"),
          },
          "*"
        );
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleDeviceChange = () => {
      // Recheck permissions and enumerate devices
      checkPermissions();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, []);

  const checkPermissions = async () => {
    // Individually check the camera and microphone permissions using the Permissions API. Then enumerate devices respectively.
    try {
      const cameraPermission = await navigator.permissions.query({
        name: "camera",
      });
      const microphonePermission = await navigator.permissions.query({
        name: "microphone",
      });

      cameraPermission.onchange = () => {
        checkPermissions();
      };

      microphonePermission.onchange = () => {
        checkPermissions();
      };

      // If `Permissions.query()` reports either granted, take the fast
      // path and enumerate.
      if (
        cameraPermission.state === "granted" ||
        microphonePermission.state === "granted"
      ) {
        enumerateDevices(
          cameraPermission.state === "granted",
          microphonePermission.state === "granted"
        );
        return;
      }

      // permissions.query() asks the iframe's own origin and reports
      // "prompt"/"denied" even when getUserMedia would succeed via
      // the parent's `allow="camera *; microphone *"`. Probe directly.
      try {
        const probeStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        // It worked; clean up the probe tracks immediately. The
        // subsequent enumerateDevices() call will request its own
        // stream when it actually needs the data; this probe was just
        // a permission test.
        probeStream.getTracks().forEach((t) => t.stop());
        enumerateDevices(true, true);
        return;
      } catch (probeErr) {
        // Real permission failure (NotAllowedError, NotFoundError if
        // no devices, NotReadableError if device in use). Surface
        // the modal.
        window.parent.postMessage(
          {
            type: "screenity-permissions",
            success: false,
            error: probeErr?.name || "unknown",
          },
          "*"
        );
      }
    } catch (err) {
      enumerateDevices();
    }
  };

  const enumerateDevices = async (camGranted = true, micGranted = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: micGranted,
        video: camGranted,
      });

      const devicesInfo = await navigator.mediaDevices.enumerateDevices();

      let audioinput = [];
      let audiooutput = [];
      let videoinput = [];

      if (micGranted) {
        // Filter by audio input
        audioinput = devicesInfo
          .filter((device) => device.kind === "audioinput")
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label,
          }));

        // Filter by audio output and extract relevant properties
        audiooutput = devicesInfo
          .filter((device) => device.kind === "audiooutput")
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label,
          }));
      }

      if (camGranted) {
        // Filter by video input and extract relevant properties
        videoinput = devicesInfo
          .filter((device) => device.kind === "videoinput")
          .map((device) => ({
            deviceId: device.deviceId,
            label: device.label,
          }));
      }

      // Save in Chrome local storage
      chrome.storage.local.set({
        // Set available devices
        audioinput: audioinput,
        audiooutput: audiooutput,
        videoinput: videoinput,
        cameraPermission: camGranted,
        microphonePermission: micGranted,
      });

      // Post message to parent window
      window.parent.postMessage(
        {
          type: "screenity-permissions",
          success: true,
          audioinput: audioinput,
          audiooutput: audiooutput,
          videoinput: videoinput,
          cameraPermission: camGranted,
          microphonePermission: micGranted,
        },
        "*"
      );

      //sendResponse({ success: true, audioinput, audiooutput, videoinput });

      // End the stream
      stream.getTracks().forEach(function (track) {
        track.stop();
      });
    } catch (err) {
      // Post message to parent window
      window.parent.postMessage(
        {
          type: "screenity-permissions",
          success: false,
          error: err.name,
        },
        "*"
      );
      //sendResponse({ success: false, error: err.name });
    }
  };

  const onMessage = (message) => {
    if (message.type === "screenity-get-permissions") {
      checkPermissions();
    }
  };

  // Post message listener
  useEffect(() => {
    window.addEventListener("message", (event) => {
      onMessage(event.data);
    });
  }, []);

  return <div></div>;
};

export default Recorder;
