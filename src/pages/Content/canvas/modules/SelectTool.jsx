import { fabric } from "fabric";

const SelectTool = (canvas, toolSettings, setToolSettings) => {
  if (toolSettings.tool === "select") {
    // Check if there's any objects on the canvas
    if (canvas.getObjects().length > 0) {
      // Make all objects on the canvas selectable
      canvas.forEachObject((object) => {
        object.set({ selectable: true, perPixelTargetFind: false });
      });

      // Make canvas selectable
      canvas.selection = true;
      canvas.renderAll();
    }
  } else {
    // Make canvas unselectable
    canvas.selection = false;
    canvas.renderAll();
  }

  // On mouse over object
  const onMouseOver = (o) => {
    if (toolSettings.tool !== "select") return;
    if (toolSettings.isAddingImage) return;
    if (!o.target) return;

    if (o.target != canvas.getActiveObject()) {
      if (o.target.type === "group" && o.target.id === "select-group") {
        // Find child of group with ID "select-stroke"
        const selectStroke = o.target._objects.find(
          (object) => object.id === "select-stroke"
        );
        selectStroke.set({ opacity: 1 });
      } else if (o.target.type === "group" && o.target.id === "arrowGroup") {
        o.target._objects.forEach((obj) => {
          if (obj.id === "arrowLineControl") {
            obj.set({ opacity: 1 });
          }
        });
      } else {
        o.target._renderControls(o.target.canvas.contextTop, {
          hasControls: false,
        });
      }
      canvas.renderAll();
    }

    // Show blue border on hover
    // o.target.set({ stroke: "blue", strokeWidth: 2 });
    //canvas.renderAll();
  };

  // On mouse out object
  const onMouseOut = (o) => {
    if (toolSettings.tool !== "select") return;
    if (!o.target) return;

    if (o.target != canvas.getActiveObject()) {
      if (o.target.type === "group" && o.target.id === "select-group") {
        // Find child of group with ID "select-stroke"
        const selectStroke = o.target._objects.find(
          (object) => object.id === "select-stroke"
        );
        selectStroke.set({ opacity: 0 });
        canvas.renderAll();
      } else if (o.target.type === "group" && o.target.id === "arrowGroup") {
        o.target._objects.forEach((obj) => {
          if (obj.id === "arrowLineControl") {
            obj.set({ opacity: 0 });
          }
        });
        canvas.renderAll();
      }
    }

    o.target.canvas.clearContext(o.target.canvas.contextTop);
    canvas.renderAll();
  };

  const checkObject = (o) => {
    if (toolSettings.isAddingImage) return;
    if (toolSettings.tool !== "select") return;
    if (!o.target) return;
    if (!o.target.canvas) return;

    o.target.canvas.clearContext(o.target.canvas.contextTop);
  };

  canvas.on("mouse:over", onMouseOver);
  canvas.on("mouse:out", onMouseOut);
  canvas.on("mouse:down", checkObject);

  return {
    removeEventListeners: function () {
      canvas.off("mouse:over", onMouseOver);
      canvas.off("mouse:out", onMouseOut);
      canvas.off("mouse:down", checkObject);
    },
  };
};

export default SelectTool;
