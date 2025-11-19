import React from "react";

import { fabric } from "fabric";
import { saveCanvas } from "./History";

const EraserTool = (canvas, toolSettings, setToolSettings) => {
  const tool = toolSettings;

  const removeEventListeners = () => {
    canvas.off("mouse:down");
    canvas.off("mouse:move");
    canvas.off("mouse:up");
    document.removeEventListener("keydown", onKeyDown);
  };

  // Eraser that deletes objects as the cursor moves (and while it is clicked, dragging) over them
  // Store objecs in an array, then delete them on mouse up
  let objectsToDelete = [];
  let isDown = false;

  if (tool.tool === "eraser") {
    // Make all objects unselectable. If a group, only set the group to unselectable, not the objects inside
    canvas.forEachObject((object) => {
      object.set({ selectable: false, perPixelTargetFind: true });
    });

    canvas.renderAll();
  }

  // Mouse down
  const onMouseDown = (o) => {
    if (tool.tool !== "eraser") return;
    objectsToDelete = [];

    isDown = true;

    if (!o.target) return;

    // Make all objects unselectable. If a group, only set the group to unselectable, not the objects inside
    canvas.forEachObject((object) => {
      object.set({ selectable: false, perPixelTargetFind: true });
    });

    // Add object to array, and set its opacity to .5
    objectsToDelete.push(o.target);
    o.target.set({ opacity: 0.5 });

    canvas.renderAll();
  };

  // Mouse move
  const onMouseMove = (o) => {
    if (tool.tool !== "eraser") return;

    // Make all objects unselectable. If a group, only set the group to unselectable, not the objects inside
    canvas.forEachObject((object) => {
      object.set({ selectable: false, perPixelTargetFind: true });
    });

    if (!isDown) return;
    if (!o.target) return;

    // Add object to array, and set its opacity to .5
    objectsToDelete.push(o.target);
    o.target.set({ opacity: 0.5 });

    canvas.renderAll();
  };

  // Mouse up
  const onMouseUp = (o) => {
    if (tool.tool !== "eraser") return;
    // Delete all objects in the array. Make sure to delete groups
    objectsToDelete.forEach((object) => {
      if (object.type === "group") {
        // If object is a group, delete it and all objects inside
        object.forEachObject((object) => {
          canvas.remove(object);
        });
        canvas.remove(object);
      } else {
        canvas.remove(object);
      }
    });

    canvas.renderAll();

    objectsToDelete = [];
    isDown = false;

    // Make all objects on the canvas selectable
    canvas.forEachObject((object) => {
      object.set({ selectable: true, perPixelTargetFind: false });
    });

    saveCanvas(toolSettings, setToolSettings);
  };

  // Detect pressing the delete or backspace key
  const onKeyDown = (e) => {
    if (e.keyCode === 8 || e.keyCode === 46) {
      // if multiple objects are selected
      const activeGroup = canvas.getActiveObjects();
      const activeObject = canvas.getActiveObject();

      if (activeGroup & !activeObject) {
        if (activeGroup.isEditing) return;
        canvas.discardActiveObject();
        activeGroup.forEach((object) => {
          canvas.remove(object);
        });
        saveCanvas(toolSettings, setToolSettings);
      }

      if (activeObject) {
        // Check if not in text editing mode
        if (activeObject.isEditing) return;
        canvas.remove(activeObject);
        saveCanvas(toolSettings, setToolSettings);
      }
    }
  };

  // Add event listeners
  document.addEventListener("keydown", onKeyDown);
  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:move", onMouseMove);
  canvas.on("mouse:up", onMouseUp);

  return {
    removeEventListeners,
  };
};

export default EraserTool;
