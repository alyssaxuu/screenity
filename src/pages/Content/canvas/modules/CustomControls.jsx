import React from "react";
import { fabric } from "fabric";

import {
  HandleControl,
  RotateControl,
  MiddleHandleControl,
  MiddleHandleControlV,
} from "./../../images/popup/images.js";

// Custom controls for the canvas, with rounded square handles and a circular rotate handle
const CustomControls = (canvas) => {
  fabric.Object.prototype.set({
    transparentCorners: false,
    borderColor: "#0D99FF",
    cornerColor: "#FFF",
    borderScaleFactor: 2,
    cornerStyle: "circle",
    cornerStrokeColor: "#0D99FF",
    borderOpacityWhenMoving: 1,
  });

  fabric.Textbox.prototype.set({
    transparentCorners: false,
    borderColor: "#0D99FF",
    cornerColor: "#FFF",
    borderScaleFactor: 2,
    cornerStyle: "circle",
    cornerStrokeColor: "#0D99FF",
    borderOpacityWhenMoving: 1,
  });

  canvas.selectionColor = "rgba(46, 115, 252, 0.11)";
  canvas.selectionBorderColor = "rgba(98, 155, 255, 0.81)";
  canvas.selectionLineWidth = 1.5;

  // Handle control
  var img = new Image();
  img.src = HandleControl;

  function renderIcon(ctx, left, top, styleOverride, fabricObject) {
    const size = 25;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // Rotate control
  var img2 = new Image();
  img2.src = RotateControl;

  function renderIconRotate(ctx, left, top, styleOverride, fabricObject) {
    const wsize = 30;
    const hsize = 30;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
    ctx.drawImage(img2, -wsize / 2, -hsize / 2, wsize, hsize);
    ctx.restore();
  }

  // Middle handle control
  var img3 = new Image();
  img3.src = MiddleHandleControl;

  function renderIconMiddle(ctx, left, top, styleOverride, fabricObject) {
    const size = 18;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
    ctx.drawImage(img3, -(size + 14) / 2, -size / 2, size + 14, size);
    ctx.restore();
  }

  // Middle handle control vertical
  var img4 = new Image();
  img4.src = MiddleHandleControlV;

  function renderIconMiddleV(ctx, left, top, styleOverride, fabricObject) {
    const size = 18;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
    ctx.drawImage(img4, -size / 2, -(size + 14) / 2, size, size + 14);
    ctx.restore();
  }

  fabric.Object.prototype.controls.tl = new fabric.Control({
    x: -0.5,
    y: -0.5,
    offsetX: -1,
    offsetY: -1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIcon,
  });

  fabric.Object.prototype.controls.tr = new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetX: 1,
    offsetY: -1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIcon,
  });

  fabric.Object.prototype.controls.bl = new fabric.Control({
    x: -0.5,
    y: 0.5,
    offsetX: -1,
    offsetY: 1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIcon,
  });

  fabric.Object.prototype.controls.br = new fabric.Control({
    x: 0.5,
    y: 0.5,
    offsetX: 1,
    offsetY: 1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIcon,
  });

  fabric.Object.prototype.controls.mr = new fabric.Control({
    x: 0.5,
    y: 0,
    offsetX: 1,
    offsetY: 0,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingXOrSkewingY,
    render: renderIconMiddleV,
  });

  fabric.Object.prototype.controls.ml = new fabric.Control({
    x: -0.5,
    y: 0,
    offsetX: -1,
    offsetY: 0,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingXOrSkewingY,
    render: renderIconMiddleV,
  });

  fabric.Object.prototype.controls.mb = new fabric.Control({
    x: 0,
    y: 0.5,
    offsetX: 0,
    offsetY: 1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingYOrSkewingX,
    render: renderIconMiddle,
  });

  fabric.Object.prototype.controls.mt = new fabric.Control({
    x: 0,
    y: -0.5,
    offsetX: 0,
    offsetY: -1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingYOrSkewingX,
    render: renderIconMiddle,
  });

  fabric.Object.prototype.controls.mtr = new fabric.Control({
    x: 0,
    y: 0.5,
    cursorStyleHandler: fabric.controlsUtils.rotationStyleHandler,
    actionHandler: fabric.controlsUtils.rotationWithSnapping,
    offsetY: 26,
    withConnecton: false,
    actionName: "rotate",
    render: renderIconRotate,
  });

  // Also use same controls for Textbox
  fabric.Textbox.prototype.controls.tl = new fabric.Control({
    x: -0.5,
    y: -0.5,
    offsetX: -1,
    offsetY: -1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIcon,
  });

  fabric.Textbox.prototype.controls.tr = new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetX: 1,
    offsetY: -1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIcon,
  });

  fabric.Textbox.prototype.controls.bl = new fabric.Control({
    x: -0.5,
    y: 0.5,
    offsetX: -1,
    offsetY: 1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIcon,
  });

  fabric.Textbox.prototype.controls.br = new fabric.Control({
    x: 0.5,
    y: 0.5,
    offsetX: 1,
    offsetY: 1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIcon,
  });

  // Ml and mr controls for Textbox. The actionhandler should be for resizing the textbox horizontally, not skewing it
  fabric.Textbox.prototype.controls.ml = new fabric.Control({
    x: -0.5,
    y: 0,
    offsetX: -1,
    offsetY: 0,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.changeWidth,
    render: renderIconMiddleV,
  });

  fabric.Textbox.prototype.controls.mr = new fabric.Control({
    x: 0.5,
    y: 0,
    offsetX: 1,
    offsetY: 0,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.changeWidth,
    render: renderIconMiddleV,
  });

  fabric.Textbox.prototype.controls.mb = new fabric.Control({
    x: 0,
    y: 0.5,
    offsetX: 0,
    visible: false,
    offsetY: 1,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.changeHeight,
    render: renderIconMiddle,
  });

  fabric.Textbox.prototype.controls.mt = new fabric.Control({
    x: 0,
    y: -0.5,
    offsetX: 0,
    offsetY: -1,
    visible: false,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.changeHeight,
    render: renderIconMiddle,
  });

  fabric.Textbox.prototype.controls.mtr = new fabric.Control({
    x: 0,
    y: 0.5,
    cursorStyleHandler: fabric.controlsUtils.rotationStyleHandler,
    actionHandler: fabric.controlsUtils.rotationWithSnapping,
    offsetY: 26,
    withConnecton: false,
    actionName: "rotate",
    render: renderIconRotate,
  });

  // Update canvas rendering
  canvas.renderAll();
};

export default CustomControls;

/*
fabric.Object.prototype.set({
  transparentCorners: false,
  borderColor: '#51B9F9',
  cornerColor: '#FFF',
  borderScaleFactor: 2.5,
  cornerStyle: 'circle',
  cornerStrokeColor: '#0E98FC',
  borderOpacityWhenMoving: 1,
});

canvas.selectionColor = 'rgba(46, 115, 252, 0.11)';
canvas.selectionBorderColor = 'rgba(98, 155, 255, 0.81)';
canvas.selectionLineWidth = 1.5;

var img = document.createElement('img');
img.src = 'assets/middlecontrol.svg';

var img2 = document.createElement('img');
img2.src = 'assets/middlecontrolhoz.svg';

var img3 = document.createElement('img');
img3.src = 'assets/edgecontrol.svg';

var img4 = document.createElement('img');
img4.src = 'assets/rotateicon.svg';

function renderIcon(ctx, left, top, styleOverride, fabricObject) {
  const wsize = 20;
  const hsize = 25;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
  ctx.drawImage(img, -wsize / 2, -hsize / 2, wsize, hsize);
  ctx.restore();
}
function renderIconHoz(ctx, left, top, styleOverride, fabricObject) {
  const wsize = 25;
  const hsize = 20;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
  ctx.drawImage(img2, -wsize / 2, -hsize / 2, wsize, hsize);
  ctx.restore();
}
function renderIconEdge(ctx, left, top, styleOverride, fabricObject) {
  const wsize = 25;
  const hsize = 25;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
  ctx.drawImage(img3, -wsize / 2, -hsize / 2, wsize, hsize);
  ctx.restore();
}

function renderIconRotate(
  ctx,
  left,
  top,
  styleOverride,
  fabricObject
) {
  const wsize = 40;
  const hsize = 40;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle));
  ctx.drawImage(img4, -wsize / 2, -hsize / 2, wsize, hsize);
  ctx.restore();
}
function resetControls() {
  fabric.Object.prototype.controls.ml = new fabric.Control({
    x: -0.5,
    y: 0,
    offsetX: -1,
    cursorStyleHandler:
      fabric.controlsUtils.scaleSkewCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingXOrSkewingY,
    getActionName: fabric.controlsUtils.scaleOrSkewActionName,
    render: renderIcon,
  });

  fabric.Object.prototype.controls.mr = new fabric.Control({
    x: 0.5,
    y: 0,
    offsetX: 1,
    cursorStyleHandler:
      fabric.controlsUtils.scaleSkewCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingXOrSkewingY,
    getActionName: fabric.controlsUtils.scaleOrSkewActionName,
    render: renderIcon,
  });

  fabric.Object.prototype.controls.mb = new fabric.Control({
    x: 0,
    y: 0.5,
    offsetY: 1,
    cursorStyleHandler:
      fabric.controlsUtils.scaleSkewCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingYOrSkewingX,
    getActionName: fabric.controlsUtils.scaleOrSkewActionName,
    render: renderIconHoz,
  });

  fabric.Object.prototype.controls.mt = new fabric.Control({
    x: 0,
    y: -0.5,
    offsetY: -1,
    cursorStyleHandler:
      fabric.controlsUtils.scaleSkewCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingYOrSkewingX,
    getActionName: fabric.controlsUtils.scaleOrSkewActionName,
    render: renderIconHoz,
  });

  fabric.Object.prototype.controls.tl = new fabric.Control({
    x: -0.5,
    y: -0.5,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIconEdge,
  });

  fabric.Object.prototype.controls.tr = new fabric.Control({
    x: 0.5,
    y: -0.5,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIconEdge,
  });

  fabric.Object.prototype.controls.bl = new fabric.Control({
    x: -0.5,
    y: 0.5,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIconEdge,
  });

  fabric.Object.prototype.controls.br = new fabric.Control({
    x: 0.5,
    y: 0.5,
    cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
    actionHandler: fabric.controlsUtils.scalingEqually,
    render: renderIconEdge,
  });

  fabric.Object.prototype.controls.mtr = new fabric.Control({
    x: 0,
    y: 0.5,
    cursorStyleHandler: fabric.controlsUtils.rotationStyleHandler,
    actionHandler: fabric.controlsUtils.rotationWithSnapping,
    offsetY: 30,
    withConnecton: false,
    actionName: 'rotate',
    render: renderIconRotate,
  });
}
resetControls();
*/
