import { fabric } from "fabric";

const createArrowLine = (x, y, color, strokeWidth) => {
  return new fabric.Line([x, y, x, y], {
    strokeWidth: (strokeWidth || 2) * 6,
    stroke: color,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    id: "arrowLine",
    objectCaching: false,
  });
};

const createArrowHead = (x, y, color, strokeWidth) => {
  const size = (strokeWidth || 2) * 16;
  return new fabric.Triangle({
    width: size,
    height: size,
    left: x,
    top: y,
    fill: color,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    id: "arrowHead",
    objectCaching: false,
  });
};

const createArrowCircle = (x, y, id) => {
  return new fabric.Circle({
    radius: 5,
    fill: "white",
    stroke: "#0D99FF",
    strokeWidth: 2,
    left: x,
    top: y,
    selectable: false,
    evented: true,
    id,
    opacity: 0,
    objectCaching: false,
  });
};

const createArrowLineControl = (x, y) => {
  return new fabric.Line([x, y, x, y], {
    strokeWidth: 2,
    stroke: "#0D99FF",
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    id: "arrowLineControl",
    opacity: 0,
    objectCaching: false,
  });
};

const ArrowTool = (canvas, contentStateRef, setContentState, saveCanvas) => {
  const getState = () => contentStateRef.current;

  let arrowPoints = [];
  let arrowLine = null;
  let arrowHead = null;
  let arrowCircle1 = null;
  let arrowCircle2 = null;
  let arrowLineControl = null;

  // --- endpoint drag handler (store ref so we can remove safely)
  const onEndpointMouseDown = (e) => {
    // Only when selecting / interacting with existing arrows
    if (!e?.subTargets?.length) return;

    const state = getState();
    // Allow endpoint dragging even if tool != arrow, but only in drawingMode
    if (!state?.drawingMode) return;

    const hit = e.subTargets.find(
      (obj) => obj?.id === "arrowCircle1" || obj?.id === "arrowCircle2",
    );
    if (!hit) return;

    moveArrowCircle(canvas, hit, getState, saveCanvas, setContentState);
  };

  const moveArrowCircle = (
    canvas,
    arrowCircle,
    getState,
    saveCanvas,
    setContentState,
  ) => {
    let isDown = true;

    const group = arrowCircle.group;
    const items = group._objects;

    const arrowCircle1 = group._objects.find(
      (item) => item.id === "arrowCircle1",
    );
    const arrowCircle2 = group._objects.find(
      (item) => item.id === "arrowCircle2",
    );
    const arrowLine = group._objects.find((item) => item.id === "arrowLine");
    const arrowHead = group._objects.find((item) => item.id === "arrowHead");
    const arrowLineControl = group._objects.find(
      (item) => item.id === "arrowLineControl",
    );

    arrowLineControl.set({ opacity: 0 });

    // Ungroup temporarily so we can edit in canvas coords
    group._restoreObjectsState();
    canvas.remove(group);
    items.forEach((item) => canvas.add(item));
    canvas.requestRenderAll();

    const updateGeometry = () => {
      const x1 = arrowCircle1.left + 5;
      const y1 = arrowCircle1.top + 5;
      const x2 = arrowCircle2.left + 5;
      const y2 = arrowCircle2.top + 5;

      arrowLine.set({ x1, y1, x2, y2 });
      arrowLineControl.set({ x1, y1, x2, y2 });

      arrowLine.setCoords();
      arrowLineControl.setCoords();

      const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      arrowHead.set({ angle: angle + 90, left: x2, top: y2 });
      arrowHead.setCoords();
    };

    const onMove = (o) => {
      if (!isDown) return;

      const pointer = canvas.getPointer(o.e);
      arrowCircle.set({ left: pointer.x - 5, top: pointer.y - 5 });
      arrowCircle.setCoords();

      updateGeometry();
      canvas.requestRenderAll();
    };

    const onUp = () => {
      if (!isDown) return;
      isDown = false;

      canvas.off("mouse:move", onMove);
      canvas.off("mouse:up", onUp);

      arrowLineControl.set({ opacity: 1 });

      const newGroup = new fabric.Group(
        [arrowLine, arrowHead, arrowLineControl, arrowCircle1, arrowCircle2],
        {
          selectable: true,
          evented: true,
          id: "arrowGroup",
          hasControls: false,
          hasBorders: false,
          hasRotatingPoint: false,
          subTargetCheck: true,
          originX: "left",
          originY: "top",
          perPixelTargetFind: true,
        },
      );

      canvas.add(newGroup);
      canvas.remove(arrowLine);
      canvas.remove(arrowHead);
      canvas.remove(arrowCircle1);
      canvas.remove(arrowCircle2);
      canvas.remove(arrowLineControl);
      canvas.requestRenderAll();

      canvas.discardActiveObject();
      canvas.requestRenderAll();

      const state = getState();
      saveCanvas({ ...state, tool: "select" }, setContentState);

      canvas.setActiveObject(newGroup);
      canvas.requestRenderAll();
    };

    canvas.on("mouse:move", onMove);
    canvas.on("mouse:up", onUp);
  };

  // --- draw handlers
  const onMouseDown = (o) => {
    const state = getState();
    if (!state?.drawingMode) return;
    if (state.tool !== "arrow") return;
    if (arrowPoints.length) return;

    canvas.selection = false;
    canvas.requestRenderAll();

    const { x, y } = canvas.getPointer(o.e);
    arrowPoints = [{ x, y }];

    arrowLine = createArrowLine(x, y, state.color, state.strokeWidth);
    arrowHead = createArrowHead(x, y, state.color, state.strokeWidth);
    arrowCircle1 = createArrowCircle(x - 5, y - 5, "arrowCircle1");
    arrowCircle2 = createArrowCircle(x - 5, y - 5, "arrowCircle2");
    arrowLineControl = createArrowLineControl(x, y);

    canvas.add(arrowLine);
    canvas.add(arrowHead);
    canvas.add(arrowLineControl);
    canvas.add(arrowCircle1);
    canvas.add(arrowCircle2);

    canvas.requestRenderAll();
  };

  const onMouseMove = (o) => {
    const state = getState();
    if (!state?.drawingMode) return;
    if (state.tool !== "arrow") return;
    if (!arrowPoints.length) return;
    if (
      !arrowLine ||
      !arrowHead ||
      !arrowCircle1 ||
      !arrowCircle2 ||
      !arrowLineControl
    )
      return;

    const { x, y } = canvas.getPointer(o.e);
    const startX = arrowPoints[0].x;
    const startY = arrowPoints[0].y;

    arrowLine.set({ x1: startX, y1: startY, x2: x, y2: y });
    arrowLineControl.set({ x1: startX, y1: startY, x2: x, y2: y });
    arrowLine.setCoords();
    arrowLineControl.setCoords();

    const angle = (Math.atan2(y - startY, x - startX) * 180) / Math.PI;
    arrowHead.set({ left: x, top: y, angle: angle + 90 });
    arrowHead.setCoords();

    arrowCircle1.set({ left: startX - 5, top: startY - 5 });

    // keep your “slight offset” if you want, but simplest is:
    arrowCircle2.set({ left: x - 5, top: y - 5 });

    arrowCircle1.setCoords();
    arrowCircle2.setCoords();

    canvas.requestRenderAll();
  };

  const onMouseUp = () => {
    const state = getState();
    if (!state?.drawingMode) return;
    if (state.tool !== "arrow") return;
    if (!arrowPoints.length) return;

    canvas.selection = true;
    arrowPoints = [];

    arrowCircle1.set({ opacity: 1 });
    arrowCircle2.set({ opacity: 1 });
    arrowLineControl.set({ opacity: 1 });

    const group = new fabric.Group(
      [arrowLine, arrowHead, arrowLineControl, arrowCircle1, arrowCircle2],
      {
        selectable: true,
        evented: true,
        id: "arrowGroup",
        hasControls: false,
        hasBorders: false,
        hasRotatingPoint: false,
        subTargetCheck: true,
        originX: "left",
        originY: "top",
        perPixelTargetFind: true,
      },
    );

    canvas.add(group);
    canvas.remove(arrowLine);
    canvas.remove(arrowHead);
    canvas.remove(arrowCircle1);
    canvas.remove(arrowCircle2);
    canvas.remove(arrowLineControl);

    canvas.requestRenderAll();

    saveCanvas({ ...state, tool: "select" }, setContentState);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
  };

  // --- selection visibility handlers (keep refs for proper off)
  const onBeforeSelectionCleared = () => {
    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.id === "arrowGroup") {
      activeObject._objects.forEach((obj) => {
        if (
          obj.id === "arrowCircle1" ||
          obj.id === "arrowCircle2" ||
          obj.id === "arrowLineControl"
        ) {
          obj.set({ opacity: 0 });
        }
      });
      canvas.requestRenderAll();
    }
  };

  const onSelectionCleared = () => {
    canvas.getObjects().forEach((obj) => {
      if (obj.type === "group") {
        obj._objects.forEach((obj2) => {
          if (
            obj2.id === "arrowCircle1" ||
            obj2.id === "arrowCircle2" ||
            obj2.id === "arrowLineControl"
          ) {
            obj2.set({ opacity: 0 });
          }
        });
      }
    });
    canvas.requestRenderAll();
  };

  const onSelectionChanged = () => {
    const activeObject = canvas.getActiveObject();

    if (activeObject && activeObject.id === "arrowGroup") {
      activeObject._objects.forEach((obj) => {
        if (
          obj.id === "arrowCircle1" ||
          obj.id === "arrowCircle2" ||
          obj.id === "arrowLineControl"
        ) {
          obj.set({ opacity: 1 });
        }
      });
      canvas.requestRenderAll();
    }

    if (activeObject && activeObject.type === "activeSelection") {
      activeObject._objects.forEach((obj) => {
        if (obj.id === "arrowGroup") {
          obj._objects.forEach((obj2) => {
            if (obj2.id === "arrowLineControl") obj2.set({ opacity: 1 });
          });
        }
      });
      canvas.requestRenderAll();
    }
  };

  // attach
  canvas.on("mouse:down", onEndpointMouseDown); // endpoint dragging
  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:move", onMouseMove);
  canvas.on("mouse:up", onMouseUp);

  canvas.on("before:selection:cleared", onBeforeSelectionCleared);
  canvas.on("selection:cleared", onSelectionCleared);
  canvas.on("selection:created", onSelectionChanged);
  canvas.on("selection:updated", onSelectionChanged);

  return {
    removeEventListeners: function () {
      canvas.off("mouse:down", onEndpointMouseDown);
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);

      canvas.off("before:selection:cleared", onBeforeSelectionCleared);
      canvas.off("selection:cleared", onSelectionCleared);
      canvas.off("selection:created", onSelectionChanged);
      canvas.off("selection:updated", onSelectionChanged);
    },
  };
};

export default ArrowTool;
