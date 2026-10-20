// Floating Document Picture-in-Picture window for the script and camera; window
// and tab captures leave it out of the recording. Chrome only opens one from a
// user gesture, so openPipLayer() must run synchronously inside the click.

export const PROMPTER_WINDOW_SIZE = { width: 420, height: 380 };

let pipWindow = null;
// The window stays open while any layer is on.
const NO_LAYERS = { prompter: false, camera: false, controls: false };
let layers = NO_LAYERS;
// Set when the user chose to keep the window up over a capture that records it.
let keepVisible = false;
const listeners = new Set();

const trace = (what, layer, reason) => {
  if (process.env.NODE_ENV === "production") return;
  console.debug("[Screenity][pip]", what, layer || "", reason || "");
};
const emit = () => listeners.forEach((fn) => fn());

export const isPrompterWindowSupported = () => {
  try {
    return typeof window.documentPictureInPicture?.requestWindow === "function";
  } catch {
    return false;
  }
};

export const getPipLayers = () => layers;

// Camera put in the window by hand stays until closed or the take ends, rather
// than waiting for a recording to start.
let cameraManual = false;
export const setCameraManual = (value) => {
  cameraManual = Boolean(value);
};
export const getCameraManual = () => cameraManual;

export const subscribePrompterWindow = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const setPrompterKeepVisible = (value) => {
  keepVisible = Boolean(value);
};

export const getPrompterKeepVisible = () => keepVisible;

export const getPrompterWindow = () =>
  pipWindow && !pipWindow.closed ? pipWindow : null;

const setLayers = (patch) => {
  layers = { ...layers, ...patch };
  emit();
};

// Must run synchronously inside a click when no window is open yet. Adding a
// layer to a window that is already open needs no gesture.
let opening = null;

export const openPipLayer = async (layer, reason) => {
  trace("open", layer, reason);
  const existing = getPrompterWindow();
  if (existing) {
    setLayers({ [layer]: true });
    if (layer === "prompter") {
      try {
        existing.focus();
      } catch {}
    }
    return true;
  }
  if (!isPrompterWindowSupported()) return false;
  if (opening) {
    await opening.catch(() => {});
    return openPipLayer(layer, reason);
  }

  let win;
  try {
    opening = window.documentPictureInPicture.requestWindow({
      ...PROMPTER_WINDOW_SIZE,
      disallowReturnToOpener: true,
    });
    win = await opening;
  } catch {
    return false;
  } finally {
    opening = null;
  }

  try {
    const doc = win.document;
    doc.title = "Screenity";
    doc.documentElement.lang = chrome.i18n.getUILanguage();
    doc.documentElement.style.height = "100%";
    Object.assign(doc.body.style, {
      margin: "0",
      height: "100%",
      overflow: "hidden",
      background: "#1b1b1f",
    });
  } catch {}

  // A window closed by hand or by the browser (navigation, another PiP
  // opening) never passes through closePrompterWindow().
  win.addEventListener("pagehide", () => {
    if (pipWindow === win) {
      trace("window gone", "", "pagehide");
      pipWindow = null;
      cameraManual = false;
      layers = NO_LAYERS;
      emit();
    }
  });
  pipWindow = win;
  keepVisible = false;
  layers = { ...NO_LAYERS, [layer]: true };
  emit();
  return true;
};

export const closePipLayer = (layer, reason) => {
  if (!layers[layer]) return;
  trace("close", layer, reason);
  if (layer === "camera") cameraManual = false;
  const next = { ...layers, [layer]: false };
  if (!next.prompter && !next.camera && !next.controls) {
    closePrompterWindow();
    return;
  }
  if (layer === "prompter") keepVisible = false;
  setLayers({ [layer]: false });
};

export const openPrompterWindow = () => openPipLayer("prompter");

export const closePrompterWindow = (reason) => {
  trace("close window", "", reason);
  const win = pipWindow;
  pipWindow = null;
  keepVisible = false;
  cameraManual = false;
  layers = NO_LAYERS;
  try {
    if (win && !win.closed) win.close();
  } catch {}
  emit();
};
