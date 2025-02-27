import { fabric } from "fabric";

const TextTool = (canvas, toolSettings, setToolSettings, saveCanvas) => {
  // Add interactive text on click, start editing
  const onMouseDown = (o) => {
    if (toolSettings.tool !== "text") return;

    const pointer = canvas.getPointer(o.e);
    const x = pointer.x;
    const y = pointer.y;

    const text = new fabric.Textbox("", {
      left: x,
      top: y,
      fontFamily: "Satoshi-Medium",
      fontSize: 20,
      fill: toolSettings.color,
      fontWeight: "normal",
      fontStyle: "normal",
      originX: "left",
      originY: "top",
      textAlign: "center",
      lockUniScaling: true,
      centeredScaling: true,
      skipAutoWidthAdjustment: false,
      perPixelTargetFind: false,
    });
    // Blue selection box while editing
    text.on("editing:entered", () => {
      text.borderColor = "#0D99FF";
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();

    // Set tool back to cursor
    setToolSettings({
      ...toolSettings,
      tool: "select",
    });

    // When user clicks off of text, save canvas
    canvas.on("mouse:down", () => {
      if (canvas.getActiveObject() !== text) {
        // Check if text is empty, if so, remove it
        if (text.text === "") {
          canvas.remove(text);
        } else {
          saveCanvas(canvas);
        }
      }
    });
  };

  const onKeyPress = (event) => {
    if (canvas.getActiveObject() === null) return;
    // check if getactiveobject is an object
    if (typeof canvas.getActiveObject() !== "object") return;

    // Check if the active object is a textbox and if the user is editing it
    if (
      canvas.getActiveObject().type !== "textbox" ||
      !canvas.getActiveObject().isEditing
    )
      return;

    // Get the active text object
    var text = canvas.getActiveObject();

    // Check if the user has explicitly set the width of the textbox
    if (text.skipAutoWidthAdjustment) return;

    // Get text in current line of text
    var currentLine = text._textLines[text._textLines.length - 1];
    // current line to string
    currentLine = currentLine.join("");

    // Check if the user is backspacing
    if (event.keyCode === 8 && currentLine.length > 0) {
      // Remove the last character from the current line
      currentLine = currentLine.slice(0, -1);
    } else {
      // Add the pressed character to the current line
      var charCode = event.charCode || event.keyCode;
      var character = String.fromCharCode(charCode);
      currentLine += character;
    }

    var newText = currentLine;

    // Create a temporary canvas to measure the text width
    var tempCanvas = document.createElement("canvas");
    var tempCtx = tempCanvas.getContext("2d");
    tempCtx.font = text.fontSize + "px " + text.fontFamily;
    var textMetrics = tempCtx.measureText(newText);

    // Adjust the width of the text if necessary
    var textWidth = Math.max(text.width, textMetrics.width + 2);
    if (textMetrics.width > text.width) {
      text.set({
        left: text.left - (textWidth - text.width) / 2,
      });

      canvas.renderAll();
      text.set("width", textWidth);
    } else {
      var maxLineWidth = getMaxLineWidth(text._textLines, text);
      if (textMetrics.width < maxLineWidth) {
        text.set({
          left: text.left + (text.width - maxLineWidth) / 2,
        });

        canvas.renderAll();
        text.set("width", maxLineWidth);
      }
    }

    canvas.renderAll();
  };

  function getMaxLineWidth(textLines, text) {
    var maxLineWidth = 0;
    var tempCanvas = document.createElement("canvas");
    var tempCtx = tempCanvas.getContext("2d");
    tempCtx.font = text.fontSize + "px " + text.fontFamily;

    for (var i = 0; i < textLines.length; i++) {
      var line = textLines[i].join("");
      var lineMetrics = tempCtx.measureText(line);
      var lineWidth = lineMetrics.width;
      maxLineWidth = Math.max(maxLineWidth, lineWidth);
    }

    return maxLineWidth;
  }

  const onResize = (e) => {
    // Check if the active object is a textbox
    if (e.target.type !== "textbox") return;

    // Set flag to skip auto width adjustment
    var text = e.target;
    text.skipAutoWidthAdjustment = true;
    canvas.renderAll();
  };

  canvas.on("mouse:down", onMouseDown);
  document.addEventListener("keydown", onKeyPress);
  canvas.on("object:resizing", onResize);
  canvas.on("mouse:move", function (event) {
    var pointer = canvas.getPointer(event.e);
    var isHoveringTextbox = false;

    canvas.forEachObject(function (obj) {
      if (obj.type === "textbox" && obj.containsPoint(pointer)) {
        isHoveringTextbox = true;
        return false;
      }
    });

    if (isHoveringTextbox) {
      // Disable perPixelTargetFind when hovering over a textbox
      canvas.perPixelTargetFind = false;
    } else {
      // Re-enable perPixelTargetFind when mouse leaves the textbox
      canvas.perPixelTargetFind = true;
    }
  });

  return {
    removeEventListeners: () => {
      canvas.off("mouse:down", onMouseDown);
      document.removeEventListener("keydown", onKeyPress);
      canvas.off("object:resizing", onResize);
      canvas.off("mouse:move");
    },
  };
};

export default TextTool;
