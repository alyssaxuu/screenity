import { fabric } from "fabric";

const createArrowLine = (x, y, color, toolSettings) => {
  return new fabric.Line([x, y, x, y], {
    strokeWidth: toolSettings.strokeWidth * 6,
    stroke: color,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    id: "arrowLine",
  });
};

const createArrowHead = (x, y, color, toolSettings) => {
  return new fabric.Triangle({
    width: toolSettings.strokeWidth * 16,
    height: toolSettings.strokeWidth * 16,
    left: x,
    top: y,
    fill: color,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    id: "arrowHead",
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
    id: id,
    opacity: 0,
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
  });
};

const moveArrowCircle = (
  canvas,
  arrowCircle,
  saveCanvas,
  toolSettings,
  setToolSettings
) => {
  let isDown = true;
  const group = arrowCircle.group;
  const items = group._objects;

  const arrowCircle1 = group._objects.find(
    (item) => item.id === "arrowCircle1"
  );
  const arrowCircle2 = group._objects.find(
    (item) => item.id === "arrowCircle2"
  );
  const arrowLine = group._objects.find((item) => item.id === "arrowLine");
  const arrowHead = group._objects.find((item) => item.id === "arrowHead");
  const arrowLineControl = group._objects.find(
    (item) => item.id === "arrowLineControl"
  );
  arrowLineControl.set({ opacity: 0 });
  group._restoreObjectsState();

  canvas.remove(group);
  items.forEach((item) => {
    canvas.add(item);
  });
  canvas.renderAll();

  canvas.on("mouse:move", (o) => {
    if (!isDown) return;

    const pointer = canvas.getPointer(o.e);
    const { x, y } = pointer;
    arrowCircle.set({ left: x - 5, top: y - 5 });
    canvas.renderAll();

    arrowLine.set({
      x1: arrowCircle1.left + 5,
      y1: arrowCircle1.top + 5,
      x2: arrowCircle2.left + 5,
      y2: arrowCircle2.top + 5,
    });

    arrowLineControl.set({
      x1: arrowCircle1.left + 5,
      y1: arrowCircle1.top + 5,
      x2: arrowCircle2.left + 5,
      y2: arrowCircle2.top + 5,
    });

    const xDiff = arrowLine.x2 - arrowLine.x1;
    const yDiff = arrowLine.y2 - arrowLine.y1;
    const angle = (Math.atan2(yDiff, xDiff) * 180) / Math.PI;
    arrowHead.set({ angle: angle + 90, left: arrowLine.x2, top: arrowLine.y2 });
  });

  canvas.on("mouse:up", (o) => {
    if (!isDown) return;
    isDown = false;
    canvas.off("mouse:move");
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
      }
    );

    canvas.add(group);
    canvas.remove(arrowLine);
    canvas.remove(arrowHead);
    canvas.remove(arrowCircle1);
    canvas.remove(arrowCircle2);
    canvas.remove(arrowLineControl);
    canvas.renderAll();
    canvas.setActiveObject(group);
    canvas.renderAll();

    // De-select arrow group
    canvas.discardActiveObject();
    canvas.renderAll();
    saveCanvas({ ...toolSettings, tool: "select" }, setToolSettings);

    // Re-select
    canvas.setActiveObject(group);
    canvas.renderAll();
  });
};

const ArrowTool = (canvas, toolSettings, setToolSettings, saveCanvas) => {
  let arrowPoints = [];
  let arrowLine = null;
  let arrowHead = null;
  let arrowCircle1 = null;
  let arrowCircle2 = null;
  let arrowLineControl = null;

  const onMouseDown = (o) => {
    if (toolSettings.tool !== "arrow") return;
    if (arrowPoints.length) return;

    // Disable canvas selection
    canvas.selection = false;
    canvas.renderAll();

    const pointer = canvas.getPointer(o.e);
    const x = pointer.x;
    const y = pointer.y;

    arrowPoints.push({ x: x, y: y });

    arrowLine = createArrowLine(x, y, toolSettings.color, toolSettings);
    arrowHead = createArrowHead(x, y, toolSettings.color, toolSettings);
    arrowCircle1 = createArrowCircle(x, y, "arrowCircle1");
    arrowCircle2 = createArrowCircle(x, y, "arrowCircle2");
    arrowLineControl = createArrowLineControl(x, y, "arrowLineControl");

    canvas.add(arrowLine);
    canvas.add(arrowHead);
    canvas.add(arrowLineControl);
    canvas.add(arrowCircle1);
    canvas.add(arrowCircle2);
  };

  const onMouseMove = (o) => {
    if (toolSettings.tool !== "arrow") return;
    if (!arrowPoints.length) return;
    if (
      !arrowLine ||
      !arrowHead ||
      !arrowCircle1 ||
      !arrowCircle2 ||
      !arrowLineControl
    )
      return;

    const pointer = canvas.getPointer(o.e);
    const x = pointer.x;
    const y = pointer.y;

    arrowLine.set({ x2: x, y2: y });
    arrowLineControl.set({ x2: x, y2: y });

    arrowHead.set({ left: x, top: y });

    const xDiff = arrowLine.x2 - arrowLine.x1;
    const yDiff = arrowLine.y2 - arrowLine.y1;
    const angle = (Math.atan2(yDiff, xDiff) * 180) / Math.PI;
    arrowHead.set({ angle: angle + 90 });

    // Position circle with offset to arrow head
    const xDiff2 = Math.cos(angle * (Math.PI / 180));
    const yDiff2 = Math.sin(angle * (Math.PI / 180));
    arrowCircle1.set({ left: arrowLine.x1 - 5, top: arrowLine.y1 - 5 });
    arrowCircle2.set({
      left: arrowLine.x2 + xDiff2 - 5,
      top: arrowLine.y2 + yDiff2 - 5,
    });

    canvas.renderAll();
  };

  const onMouseUp = (o) => {
    if (toolSettings.tool !== "arrow") return;
    if (!arrowPoints.length) return;

    // Enable canvas selection
    canvas.selection = true;
    canvas.renderAll();

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
      }
    );

    canvas.add(group);
    canvas.remove(arrowLine);
    canvas.remove(arrowHead);
    canvas.remove(arrowCircle1);
    canvas.remove(arrowCircle2);
    canvas.remove(arrowLineControl);
    canvas.renderAll();
    saveCanvas({ ...toolSettings, tool: "select" }, setToolSettings);
    canvas.setActiveObject(group);
    canvas.renderAll();
  };

  fabric.Canvas.prototype.getItem = function (id) {
    let object = null;
    const objects = this.getObjects();

    for (let i = 0, len = this.size(); i < len; i++) {
      if (objects[i].id && objects[i].id === id) {
        object = objects[i];
        break;
      }
    }

    return object;
  };

  canvas.on("mouse:down", function (e) {
    // Check event subtargets if includes element with ID property arrowCircle1 or arrowCircle2
    if (e.subTargets) {
      e.subTargets.forEach((obj) => {
        if (obj.id === "arrowCircle1" || obj.id === "arrowCircle2") {
          moveArrowCircle(
            canvas,
            obj,
            saveCanvas,
            toolSettings,
            setToolSettings
          );
        }
      });
    }
  });

  canvas.on("before:selection:cleared", function (e) {
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
      canvas.renderAll();
    }
  });

  canvas.on("selection:updated", function (e) {
    // Set opacity 0 to all arrow circles in the canvas (irrespective of group)
    canvas.getObjects().forEach((obj) => {
      if (obj.type == "group") {
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
  });

  canvas.on("selection:cleared", function (e) {
    // Set opacity 0 to all arrow circles in the canvas (irrespective of group)
    canvas.getObjects().forEach((obj) => {
      if (obj.type == "group") {
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
  });

  canvas.on("selection:created", function (e) {
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
      canvas.renderAll();
    }

    // Also for multiple selection
    if (activeObject && activeObject.type === "activeSelection") {
      activeObject._objects.forEach((obj) => {
        if (obj.id === "arrowGroup") {
          obj._objects.forEach((obj2) => {
            if (obj2.id === "arrowLineControl") {
              obj2.set({ opacity: 1 });
            }
          });
        }
      });
      canvas.renderAll();
    }
  });

  canvas.on("selection:updated", function (e) {
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
      canvas.renderAll();
    }
  });

  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:move", onMouseMove);
  canvas.on("mouse:up", onMouseUp);

  return {
    removeEventListeners: function () {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
      canvas.off("before:selection:cleared");
      canvas.off("selection:cleared");
      canvas.off("mouse:down");
    },
  };
};

export default ArrowTool;
