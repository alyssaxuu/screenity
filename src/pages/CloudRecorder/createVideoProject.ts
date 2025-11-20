const VIDEO_INIT = {
  aspectRatio: {
    width: 16,
    height: 9,
    source: "preset",
    preset: "Youtube (16:9)",
  },
  hasRecordingSession: true,
  baseResolution: 720,
  duration: 12,
  fps: 30,
  lastUsedBackdrop: { categoryId: 5, backdropId: 8 },
  lastUsedStylePrefs: {
    screen: {
      padding: 0.8,
      cornerRadius: 0,
      darkMode: false,
      statusBar: false,
      url: "",
      shadow: 0,
      borderThickness: 0,
    },
    camera: {
      padding: 0.8,
      roundness: 1,
    },
    shadowStrength: 0.5,
  },
  lastUsedLayout: {
    type: "cameraVideo",
    layout: "bubble1",
  },
  lastUsedMockup: {
    id: "macbookPro16",
    category: "laptop",
    model: "16-inch",
    color: "silver",
  },
  lastUsedKeyframe: {
    cameraZoom: true,
    cameraScale: 0.8,
    preset: "CINEMATIC",
  },
  captionSettings: {
    enabled: false,
    size: 100,
    position: 82,
    style: "modern-glass",
    defaultSource: "screen",
    textDirection: "ltr",
    wordByWord: false,
  },
  audioSettings: {
    enabled: false,
    track: "none",
    volume: 0.5,
    loop: true,
  },
  sceneOrder: [],
  scenes: {},
};

interface CreateVideoProjectOptions {
  title?: string;
  instantMode?: boolean;
}

export const createVideoProject = async ({
  title = "Untitled Recording",
  instantMode = false,
}: CreateVideoProjectOptions = {}): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      return reject(new Error("Chrome extension runtime is not available"));
    }

    let data = VIDEO_INIT;

    if (instantMode) {
      data = {
        ...data,
        instantMode: true,
      } as typeof VIDEO_INIT & { instantMode: boolean };
    }

    chrome.runtime.sendMessage(
      {
        type: "create-video-project",
        title,
        data,
        instantMode,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(
            new Error(
              "Extension runtime error: " + chrome.runtime.lastError.message
            )
          );
        }

        if (!response || !response.success) {
          if (response?.message === "User not authenticated") {
            chrome.runtime.sendMessage({ type: "handle-login" });
            return reject(new Error("User not authenticated — login required"));
          }

          return reject(
            new Error(response?.error || "Failed to create video project")
          );
        }

        resolve(response.videoId);
      }
    );
  });
};
