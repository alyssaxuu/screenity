import { fabric } from "fabric";

const SelectTool = (canvas, contentStateRef, setContentState) => {
  const getState = () => contentStateRef.current;

  // On mouse over object
  const onMouseOver = (o) => {
    const state = getState();
    if (!state) return;
    if (state.tool !== "select") return;
    if (state.isAddingImage) return;
    if (!o.target) return;

    if (o.target !== canvas.getActiveObject()) {
      if (o.target.type === "group" && o.target.id === "select-group") {
        const selectStroke = o.target._objects?.find(
          (object) => object.id === "select-stroke",
        );
        if (selectStroke) selectStroke.set({ opacity: 1 });
      } else if (o.target.type === "group" && o.target.id === "arrowGroup") {
        o.target._objects?.forEach((obj) => {
          if (obj.id === "arrowLineControl") obj.set({ opacity: 1 });
        });
      } else {
        // draws fabric controls on the top context
        o.target._renderControls(o.target.canvas.contextTop, {
          hasControls: false,
        });
      }
      canvas.requestRenderAll();
    }
  };

  // On mouse out object
  const onMouseOut = (o) => {
    const state = getState();
    if (!state) return;
    if (state.tool !== "select") return;
    if (!o.target) return;

    if (o.target !== canvas.getActiveObject()) {
      if (o.target.type === "group" && o.target.id === "select-group") {
        const selectStroke = o.target._objects?.find(
          (object) => object.id === "select-stroke",
        );
        if (selectStroke) selectStroke.set({ opacity: 0 });
      } else if (o.target.type === "group" && o.target.id === "arrowGroup") {
        o.target._objects?.forEach((obj) => {
          if (obj.id === "arrowLineControl") obj.set({ opacity: 0 });
        });
      }
    }

    if (o.target?.canvas?.contextTop) {
      o.target.canvas.clearContext(o.target.canvas.contextTop);
    }
    canvas.requestRenderAll();
  };

  const onMouseDown = (o) => {
    const state = getState();
    if (!state) return;
    if (state.isAddingImage) return;
    if (state.tool !== "select") return;
    if (!o.target?.canvas?.contextTop) return;

    o.target.canvas.clearContext(o.target.canvas.contextTop);
  };

  canvas.on("mouse:over", onMouseOver);
  canvas.on("mouse:out", onMouseOut);
  canvas.on("mouse:down", onMouseDown);

  return {
    removeEventListeners: function () {
      canvas.off("mouse:over", onMouseOver);
      canvas.off("mouse:out", onMouseOut);
      canvas.off("mouse:down", onMouseDown);
    },
  };
};

export default SelectTool;
