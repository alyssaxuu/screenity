import { fabric } from "fabric";

const PenTool = (canvas, contentStateRef, setContentState, saveCanvas) => {
  const getState = () => contentStateRef.current;

  const resetBrushStroke = () => {
    const brush = canvas.freeDrawingBrush;
    if (!brush) return;

    // Fabric versions differ; do all safe resets.
    if (Array.isArray(brush._points)) brush._points.length = 0;
    if (Array.isArray(brush.points)) brush.points.length = 0;

    // Some brushes keep a "latest" pointer
    brush._reset && brush._reset();
  };

  const ensureBrush = () => {
    // fabric creates freeDrawingBrush lazily; make sure it's there
    if (!canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    }
    return canvas.freeDrawingBrush;
  };

  const syncBrushFromState = () => {
    const state = getState();
    if (!state) return;

    const brush = ensureBrush();

    // reset defaults
    brush.drawStraightLine = false;
    brush.straightLineKey = "none";
    brush.strokeLineCap = "round";
    brush.globalCompositeOperation = "source-over";

    if (state.tool === "pen") {
      brush.width = (state.strokeWidth || 2) * 4;
      brush.color = state.color;
      resetBrushStroke();
      return;
    }

    if (state.tool === "highlighter") {
      brush.width = (state.strokeWidth || 2) * 10;
      brush.color = new fabric.Color(state.color).setAlpha(0.5).toRgba();
      brush.globalCompositeOperation = "destination-over";
      brush.strokeLineCap = "square";
      resetBrushStroke();
    }
  };

  // Sync brush on interactions so tool switches apply immediately
  const onMouseDown = () => {
    syncBrushFromState();
  };

  const onMouseUp = () => {
    const state = getState();
    if (!state) return;
    if (state.tool !== "pen" && state.tool !== "highlighter") return;

    // Save with latest state
    // If you updated saveCanvas to accept ref, use: saveCanvas(contentStateRef, setContentState)
    saveCanvas(state, setContentState);
  };

  const onPathCreated = (o) => {
    // Only wrap paths if we were drawing (pen/highlighter)
    const state = getState();
    if (!state) return;
    if (state.tool !== "pen" && state.tool !== "highlighter") return;

    const path = o.path;
    if (!path) return;

    const pathCopy = new fabric.Path(path.path, {
      id: "select-stroke",
      stroke: "#0D99FF",
      strokeWidth: 2,
      fill: null,
      opacity: 0,
      selectable: false,
      evented: false,
    });

    const group = new fabric.Group([path, pathCopy], {
      selectable: true,
      evented: true,
      id: "select-group",
      subTargetCheck: true,
      perPixelTargetFind: true,
      hasControls: false,
      hasBorders: false,
    });

    canvas.add(group);
    canvas.remove(path);
    canvas.requestRenderAll();
  };

  const hideAllSelectStrokes = () => {
    canvas.getObjects().forEach((obj) => {
      if (obj.type === "group") {
        obj._objects?.forEach((child) => {
          if (child.id === "select-stroke") child.set({ opacity: 0 });
        });
      }
    });
  };

  const activateStroke = () => {
    const state = getState();
    if (!state) return;
    if (state.tool !== "select") return;

    hideAllSelectStrokes();

    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.id === "select-group") {
      activeObject._objects?.forEach((child) => {
        if (child.id === "select-stroke") child.set({ opacity: 1 });
      });
    }

    const activeObjects = canvas.getActiveObjects();
    if (activeObjects && activeObjects.length > 1) {
      activeObjects.forEach((obj) => {
        if (obj.id === "select-group") {
          obj._objects?.forEach((child) => {
            if (child.id === "select-stroke") child.set({ opacity: 1 });
          });
        }
      });
    }

    canvas.requestRenderAll();
  };

  const deactivateStroke = () => {
    hideAllSelectStrokes();
    canvas.requestRenderAll();
  };

  // Attach once
  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:up", onMouseUp);
  canvas.on("path:created", onPathCreated);
  canvas.on("selection:created", activateStroke);
  canvas.on("selection:updated", activateStroke);
  canvas.on("selection:cleared", deactivateStroke);

  // Initial sync
  syncBrushFromState();

  return {
    removeEventListeners: () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:up", onMouseUp);
      canvas.off("path:created", onPathCreated);
      canvas.off("selection:created", activateStroke);
      canvas.off("selection:updated", activateStroke);
      canvas.off("selection:cleared", deactivateStroke);
    },
  };
};

export default PenTool;
