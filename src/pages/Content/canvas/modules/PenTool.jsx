import { fabric } from "fabric";

const PenTool = (canvas, toolSettings, setToolSettings, saveCanvas) => {
  if (toolSettings.tool === "pen") {
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush.drawStraightLine = false;
    canvas.freeDrawingBrush.width = toolSettings.strokeWidth * 4;
    canvas.freeDrawingBrush.color = toolSettings.color;
    canvas.freeDrawingBrush.straightLineKey = "none";
  } else if (toolSettings.tool === "highlighter") {
    canvas.isDrawingMode = true;
    canvas.freeDrawingBrush.drawStraightLine = false;
    canvas.freeDrawingBrush.straightLineKey = "none";
    canvas.freeDrawingBrush.width = toolSettings.strokeWidth * 10;
    // Make the highlighter transparent
    canvas.freeDrawingBrush.color = new fabric.Color(toolSettings.color)
      .setAlpha(0.5)
      .toRgba();
    // Make the highlighter not draw on top of existing objects
    canvas.freeDrawingBrush.globalCompositeOperation = "destination-over";
    // Make the highlighter brush tip square
    canvas.freeDrawingBrush.strokeLineCap = "square";
  } else {
    canvas.isDrawingMode = false;
  }

  const onMouseUp = (o) => {
    if (toolSettings.tool !== "pen" && toolSettings.tool !== "highlighter")
      return;
    saveCanvas(toolSettings, setToolSettings);
  };

  const onPathCreated = (o) => {
    // Make a copy of the path with a thin blue stroke. Then group the two paths together
    const path = o.path;
    const pathCopy = new fabric.Path(path.path, {
      id: "select-stroke",
      stroke: "#0D99FF",
      strokeWidth: 2,
      fill: null,
      opacity: 0,
    });
    const group = new fabric.Group([path, pathCopy], {
      // Make the group selectable
      selectable: true,
      id: "select-group",
    });
    canvas.add(group);
    // Remove the original path from the canvas
    canvas.remove(path);
    canvas.renderAll();
  };

  const activateStroke = (o) => {
    if (toolSettings.tool !== "select") return;

    canvas.getObjects().forEach((obj) => {
      if (obj.type == "group") {
        obj._objects.forEach((obj2) => {
          if (obj2.id === "select-stroke") {
            obj2.set({ opacity: 0 });
            canvas.renderAll();
          }
        });
      }
    });

    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.id === "select-group") {
      activeObject._objects.forEach((obj) => {
        if (obj.id === "select-stroke") {
          obj.set({ opacity: 1 });
        }
      });
      canvas.renderAll();
    }

    // Also if multiple selected objects, show the blue border in all of them
    const activeGroup = canvas.getActiveObjects();
    if (activeGroup && activeGroup.length > 1) {
      activeGroup.forEach((obj) => {
        if (obj.id === "select-group") {
          obj._objects.forEach((obj) => {
            if (obj.id === "select-stroke") {
              obj.set({ opacity: 1 });
            }
          });
        }
      });
      canvas.renderAll();
    }
  };
  const deactivateStroke = (o) => {
    canvas.getObjects().forEach((obj) => {
      if (obj.type == "group") {
        obj._objects.forEach((obj2) => {
          if (obj2.id === "select-stroke") {
            obj2.set({ opacity: 0 });
            canvas.renderAll();
          }
        });
      }
    });
  };

  canvas.on("mouse:up", onMouseUp);
  canvas.on("path:created", onPathCreated);
  canvas.on("selection:created", activateStroke);
  canvas.on("selection:updated", activateStroke);
  canvas.on("selection:cleared", deactivateStroke);

  return {
    removeEventListeners: () => {
      canvas.off("mouse:up", onMouseUp);
      canvas.off("path:created", onPathCreated);
      canvas.off("selection:created", activateStroke);
      canvas.off("selection:updated", activateStroke);
      canvas.off("selection:cleared", deactivateStroke);
    },
  };
};

export default PenTool;
