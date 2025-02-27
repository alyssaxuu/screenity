import { fabric } from "fabric";

const ImageTool = (canvas, src, toolSettings, setToolSettings, saveCanvas) => {
  // Show image placeholder (semi transparent ghost image following cursor) to allow user to place image on canvas (source is in the image argument), drag to resize
  const image = new Image();
  let fabricImage = null;
  image.src = src;

  setToolSettings({ ...toolSettings, tool: "select", isAddingImage: true });

  // Make all objects unselectable
  canvas.forEachObject((obj) => {
    obj.selectable = false;
    canvas.renderAll();
  });

  image.onload = () => {
    fabricImage = new fabric.Image(image);
    fabricImage.set({
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      strokeUniform: true,
      angle: 0,
      fill: "transparent",
      noScaleCache: false,
      opacity: 0.5,
      selectable: false,
    });
    canvas.add(fabricImage);
    canvas.renderAll();

    // Scale image to max width or height of 500px
    const maxWidth = 500;
    const maxHeight = 500;
    const width = fabricImage.width;
    const height = fabricImage.height;
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    fabricImage.set({ scaleX: ratio, scaleY: ratio });
    canvas.renderAll();

    toolSettings.openToast(chrome.i18n.getMessage("addImageToastTitle"), () => {
      canvas.remove(fabricImage);
      canvas.renderAll();
      fabricImage = null;
      setToolSettings({ ...toolSettings, isAddingImage: false });

      // Make all objects selectable
      canvas.forEachObject((obj) => {
        obj.selectable = true;
      });
    });
  };

  let isDown = false;

  // Mouse move
  const onMouseMove = (o) => {
    if (!fabricImage) return;

    //if (!isDown) {
    // Show ghost image following cursor, drag to resize, click to place
    var pointer = canvas.getPointer(o.e);
    fabricImage.set({
      left: pointer.x,
      top: pointer.y,
    });
    fabricImage.setCoords();
    canvas.renderAll();
    //} else {
    //  // Rescale image based on mouse position
    //  var pointer = canvas.getPointer(o.e);
    //  const width = pointer.x - fabricImage.left;
    //   const height = pointer.y - fabricImage.top;
    //   const ratio = Math.min(
    //     width / fabricImage.width,
    //     height / fabricImage.height
    //   );
    //   fabricImage.set({ scaleX: ratio, scaleY: ratio });
    //   canvas.renderAll();
    // }
  };

  const onMouseDown = (o) => {
    if (!fabricImage) return;
    isDown = true;
    // Disable canvas selection
    canvas.selection = false;
    canvas.renderAll();
  };

  const onMouseUp = (o) => {
    if (!fabricImage) return;
    isDown = false;
    fabricImage.set({
      opacity: 1,
      selectable: true,
    });
    fabricImage.setCoords();
    canvas.renderAll();
    saveCanvas(toolSettings, setToolSettings);
    setToolSettings({ ...toolSettings, tool: "select", isAddingImage: false });
    canvas.setActiveObject(fabricImage);
    canvas.renderAll();
    // Make all objects selectable
    canvas.forEachObject((obj) => {
      obj.selectable = true;
    });
    canvas.renderAll();
    fabricImage = null;
  };

  canvas.on("mouse:move", onMouseMove);
  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:up", onMouseUp);

  return {
    removeEventListeners: () => {
      canvas.off("mouse:move", onMouseMove);
      canvas.off("mouse:down", onMouseDown);
    },
  };
};

export default ImageTool;
