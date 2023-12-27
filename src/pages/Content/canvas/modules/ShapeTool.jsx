import React from "react";

import { fabric } from "fabric";

const ShapeTool = (canvas, toolSettings, setToolSettings, saveCanvas) => {
  const tool = toolSettings;
  let shape;
  let isDown = false;
  let origX;
  let origY;

  const onMouseDown = (o) => {
    if (tool.tool !== "shape") return;
    isDown = true;
    const pointer = canvas.getPointer(o.e);
    origX = pointer.x;
    origY = pointer.y;
    if (tool.shape === "rectangle") {
      shape = new fabric.Rect({
        left: origX,
        top: origY,
        originX: "left",
        originY: "top",
        width: pointer.x - origX,
        height: pointer.y - origY,
        strokeUniform: true,
        angle: 0,
        fill: tool.shapeFill ? toolSettings.color : "transparent",
        noScaleCache: false,
        stroke: toolSettings.color,
        strokeWidth: toolSettings.strokeWidth * 6,
      });
    } else if (tool.shape === "triangle") {
      shape = new fabric.Triangle({
        left: origX,
        top: origY,
        originX: "left",
        originY: "top",
        strokeMilterLimit: 8,
        objectCaching: false,
        width: pointer.x - origX,
        height: pointer.y - origY,
        strokeUniform: true,
        angle: 0,
        fill: tool.shapeFill ? toolSettings.color : "transparent",
        noScaleCache: false,
        stroke: toolSettings.color,
        strokeWidth: toolSettings.strokeWidth * 6,
      });
    } else if (tool.shape === "circle") {
      shape = new fabric.Circle({
        left: origX,
        top: origY,
        originX: "left",
        originY: "top",
        radius: Math.abs(pointer.x - origX) / 2,
        strokeUniform: true,
        angle: 0,
        fill: tool.shapeFill ? toolSettings.color : "transparent",
        noScaleCache: false,
        stroke: toolSettings.color,
        strokeWidth: toolSettings.strokeWidth * 6,
      });
    }
    canvas.add(shape);
  };

  const onMouseMove = (o) => {
    if (tool.tool !== "shape") return;
    if (!isDown) return;
    const pointer = canvas.getPointer(o.e);

    if (origX > pointer.x) {
      shape.set({ left: Math.abs(pointer.x) });
    }
    if (origY > pointer.y) {
      shape.set({ top: Math.abs(pointer.y) });
    }

    if (tool.shape === "rectangle" || tool.shape === "triangle") {
      shape.set({ width: Math.abs(origX - pointer.x) });
      shape.set({ height: Math.abs(origY - pointer.y) });
    } else if (tool.shape === "circle") {
      shape.set({
        radius: Math.abs(pointer.x - origX) / 2,
      });
    }

    canvas.requestRenderAll();
  };

  const onMouseUp = (o) => {
    if (tool.tool !== "shape") return;
    isDown = false;
    canvas.renderAll();
    saveCanvas({ ...toolSettings, tool: "select" }, setToolSettings);
    canvas.setActiveObject(shape);
    canvas.renderAll();
  };

  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:move", onMouseMove);
  canvas.on("mouse:up", onMouseUp);

  return {
    removeEventListeners: function () {
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:up", onMouseUp);
    },
  };
};

export default ShapeTool;
