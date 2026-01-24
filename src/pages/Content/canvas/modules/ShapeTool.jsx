import { fabric } from "fabric";

const ShapeTool = (canvas, contentStateRef, setContentState, saveCanvas) => {
  const getState = () => contentStateRef.current;

  let shape = null;
  let isDown = false;
  let origX = 0;
  let origY = 0;

  const makeShape = (state, pointer) => {
    const color = state.color;
    const strokeWidth = (state.strokeWidth || 2) * 6;
    const fill = state.shapeFill ? color : "transparent";

    if (state.shape === "rectangle") {
      return new fabric.Rect({
        left: origX,
        top: origY,
        originX: "left",
        originY: "top",
        width: 0,
        height: 0,
        strokeUniform: true,
        angle: 0,
        fill,
        noScaleCache: false,
        stroke: color,
        strokeWidth,
      });
    }

    if (state.shape === "triangle") {
      return new fabric.Triangle({
        left: origX,
        top: origY,
        originX: "left",
        originY: "top",
        strokeMilterLimit: 8,
        objectCaching: false,
        width: 0,
        height: 0,
        strokeUniform: true,
        angle: 0,
        fill,
        noScaleCache: false,
        stroke: color,
        strokeWidth,
      });
    }

    // circle
    return new fabric.Circle({
      left: origX,
      top: origY,
      originX: "left",
      originY: "top",
      radius: 0,
      strokeUniform: true,
      angle: 0,
      fill,
      noScaleCache: false,
      stroke: color,
      strokeWidth,
    });
  };

  const onMouseDown = (o) => {
    const state = getState();
    if (!state?.drawingMode) return;
    if (state.tool !== "shape") return;

    isDown = true;

    const pointer = canvas.getPointer(o.e);
    origX = pointer.x;
    origY = pointer.y;

    shape = makeShape(state, pointer);
    canvas.add(shape);
    canvas.requestRenderAll();
  };

  const onMouseMove = (o) => {
    const state = getState();
    if (!state?.drawingMode) return;
    if (state.tool !== "shape") return;
    if (!isDown || !shape) return;

    const pointer = canvas.getPointer(o.e);

    // Handle dragging “backwards”
    const left = Math.min(origX, pointer.x);
    const top = Math.min(origY, pointer.y);
    const w = Math.abs(pointer.x - origX);
    const h = Math.abs(pointer.y - origY);

    shape.set({ left, top });

    if (state.shape === "rectangle" || state.shape === "triangle") {
      shape.set({ width: w, height: h });
    } else if (state.shape === "circle") {
      // Use min dimension so it stays circular
      const r = Math.min(w, h) / 2;
      shape.set({ radius: r });
    }

    shape.setCoords();
    canvas.requestRenderAll();
  };

  const onMouseUp = () => {
    const state = getState();
    if (!state?.drawingMode) return;
    if (state.tool !== "shape") return;
    if (!isDown) return;

    isDown = false;

    canvas.requestRenderAll();

    // Save with latest state (not stale snapshot)
    saveCanvas({ ...state, tool: "select" }, setContentState);

    if (shape) {
      canvas.setActiveObject(shape);
      canvas.requestRenderAll();
    }
  };

  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:move", onMouseMove);
  canvas.on("mouse:up", onMouseUp);

  return {
    removeEventListeners: () => {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
    },
  };
};

export default ShapeTool;
