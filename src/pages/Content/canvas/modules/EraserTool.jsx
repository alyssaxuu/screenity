import { saveCanvas } from "./History";

const EraserTool = (canvas, contentStateRef, setContentState) => {
  const getState = () => contentStateRef.current;

  let objectsToDelete = [];
  let isDown = false;

  const setEraserHitTestMode = (enabled) => {
    // enabled: perPixelTargetFind true, selectable false
    canvas.forEachObject((object) => {
      object.set({
        selectable: false,
        perPixelTargetFind: enabled ? true : false,
      });
    });
  };

  const onMouseDown = (o) => {
    const state = getState();
    if (!state?.drawingMode) return;
    if (state.tool !== "eraser") return;

    objectsToDelete = [];
    isDown = true;

    setEraserHitTestMode(true);

    if (!o.target) return;

    objectsToDelete.push(o.target);
    o.target.set({ opacity: 0.5 });

    canvas.requestRenderAll();
  };

  const onMouseMove = (o) => {
    const state = getState();
    if (!state?.drawingMode) return;
    if (state.tool !== "eraser") return;

    if (!isDown) return;
    if (!o.target) return;

    // avoid duplicates (optional but nice)
    if (!objectsToDelete.includes(o.target)) {
      objectsToDelete.push(o.target);
      o.target.set({ opacity: 0.5 });
    }

    canvas.requestRenderAll();
  };

  const onMouseUp = () => {
    const state = getState();
    if (!state?.drawingMode) return;
    if (state.tool !== "eraser") return;

    // delete collected
    objectsToDelete.forEach((object) => {
      if (!object) return;

      if (object.type === "group") {
        // remove group children then group
        object._objects?.forEach((child) => canvas.remove(child));
        canvas.remove(object);
      } else {
        canvas.remove(object);
      }
    });

    // restore opacities if any remained (in case duplicates / removed objects)
    canvas.getObjects().forEach((obj) => {
      if (obj?.opacity === 0.5) obj.set({ opacity: 1 });
    });

    objectsToDelete = [];
    isDown = false;

    // Selection logic is handled by your CanvasWrap effect (based on tool),
    // so we don't force selectable=true here.
    canvas.requestRenderAll();

    saveCanvas(contentStateRef, setContentState);
  };

  const onKeyDown = (e) => {
    const state = getState();
    if (!state?.drawingMode) return;
    if (state.tool !== "eraser") return;

    if (e.key === "Backspace" || e.key === "Delete") {
      const activeObjects = canvas.getActiveObjects();
      const activeObject = canvas.getActiveObject();

      // If text editing, don't delete
      if (activeObject?.isEditing) return;

      if (activeObjects && activeObjects.length > 1 && !activeObject) {
        canvas.discardActiveObject();
        activeObjects.forEach((obj) => canvas.remove(obj));
        saveCanvas(contentStateRef, setContentState);
        canvas.requestRenderAll();
        return;
      }

      if (activeObject) {
        canvas.remove(activeObject);
        saveCanvas(contentStateRef, setContentState);
        canvas.requestRenderAll();
      }
    }
  };

  // Attach listeners once
  document.addEventListener("keydown", onKeyDown);
  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:move", onMouseMove);
  canvas.on("mouse:up", onMouseUp);

  return {
    removeEventListeners: () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
    },
  };
};

export default EraserTool;
