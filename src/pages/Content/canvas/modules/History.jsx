import { fabric } from "../fabricCompat";

const getState = (stateOrRef) =>
  stateOrRef && stateOrRef.current ? stateOrRef.current : stateOrRef;

// Undo and redo functionality for Fabric.js
const undoCanvas = (stateOrRef, setToolSettings) => {
  const state = getState(stateOrRef);
  if (!state?.canvas) return;

  const canvas = state.canvas;

  if (state.undoStack?.length > 0) {
    const undoStack = [...state.undoStack];
    const redoStack = [...(state.redoStack || [])];

    const lastItem = undoStack.pop();
    redoStack.push(lastItem);

    const penultimateItem = undoStack[undoStack.length - 1];
    if (!penultimateItem) {
      // nothing meaningful to load
      setToolSettings({ ...state, undoStack, redoStack });
      return;
    }

    canvas.clear();
    canvas.renderAll();

    // v6 change: loadFromJSON's second arg is a per-object reviver
    // (called for every deserialized object), NOT the load-complete
    // callback. The function now returns a Promise that resolves when
    // loading finishes. v5-style callback usage would either silently
    // misfire (treating the callback as a reviver) or never run the
    // post-load cleanup.
    canvas.loadFromJSON(penultimateItem).then(() => {
      canvas.discardActiveObject();
      canvas.renderAll();
    });

    setToolSettings({ ...state, undoStack, redoStack });
  }
};

const redoCanvas = (stateOrRef, setToolSettings) => {
  const state = getState(stateOrRef);
  if (!state?.canvas) return;

  const canvas = state.canvas;

  if (state.redoStack?.length > 0) {
    const undoStack = [...(state.undoStack || [])];
    const redoStack = [...state.redoStack];

    const lastItem = redoStack.pop();
    undoStack.push(lastItem);

    // v6: loadFromJSON returns a Promise. See undoCanvas comment above.
    canvas.loadFromJSON(lastItem).then(() => {
      canvas.discardActiveObject();
      canvas.renderAll();
    });

    setToolSettings({ ...state, undoStack, redoStack });
  }
};

const saveCanvas = (stateOrRef, setToolSettings) => {
  const state = getState(stateOrRef);
  if (!state?.canvas) return;

  const canvas = state.canvas;

  const json = canvas.toJSON([
    "id",
    "selectable",
    "evented",
    "hasControls",
    "hasBorders",
    "hasRotatingPoint",
    "subTargetCheck",
    "originX",
    "originY",
    "perPixelTargetFind",
    "skipAutoWidthAdjustment",
  ]);

  const jsonString = JSON.stringify(json);
  const undoStack = [...(state.undoStack || []), jsonString];

  setToolSettings({
    ...state,
    undoStack,
    redoStack: [],
  });
};

const checkChanges = (canvas, stateRef, setToolSettings) => {
  const onChange = () => {
    // always save with latest state
    saveCanvas(stateRef, setToolSettings);
  };

  canvas.on("object:modified", onChange);

  return {
    removeEventListeners: function () {
      canvas.off("object:modified", onChange);
    },
  };
};

export { undoCanvas, redoCanvas, saveCanvas, checkChanges };
