import React, { useEffect, useRef, useContext } from "react";
import { fabric } from "fabric";

// Context
import { contentStateContext } from "../../context/ContentState";

// Components
import TextToolbar from "./TextToolbar";

// Canvas setup
import CustomControls from "../modules/CustomControls";

// Canvas tools
import ArrowTool from "../modules/ArrowTool";
import EraserTool from "../modules/EraserTool";
import ShapeTool from "../modules/ShapeTool";
import TextTool from "../modules/TextTool";
import PenTool from "../modules/PenTool";
import SelectTool from "../modules/SelectTool";

// Canvas utils
import {
  undoCanvas,
  redoCanvas,
  saveCanvas,
  checkChanges,
} from "../modules/History";

const CanvasWrap = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const contentStateRef = useRef(null);
  const canvasContainer = useRef();
  const canvasRef = useRef();
  const fabricRef = useRef();

  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);

  // INIT
  useEffect(() => {
    if (!canvasRef.current) return;
    if (fabricRef.current) return;

    const canvas = new fabric.Canvas("canvas-screenity", {
      perPixelTargetFind: true,
    });
    fabricRef.current = canvas;

    // Get context
    canvas.getContext("2d", { willReadFrequently: true });

    // Set width and height of canvas to full size of document
    canvas.setWidth(window.document.body.offsetWidth);

    // set max height of 2000px
    //canvas.setHeight(Math.min(window.document.body.offsetHeight, 2500));
    // set height to viewport
    canvas.setHeight(window.innerHeight);

    canvas.renderAll();

    setContentState((prevContentState) => ({
      ...prevContentState,
      canvas: canvas,
    }));

    CustomControls(canvas);
    saveCanvas(
      {
        ...contentState,
        canvas: canvas,
      },
      setContentState
    );
  }, []);

  // Update canvas dimensions + panning on window resize
  useEffect(() => {
    if (!fabricRef.current) return;

    const resizeCanvas = () => {
      fabricRef.current.setWidth(window.document.body.offsetWidth);
      fabricRef.current.setHeight(window.innerHeight);
      fabricRef.current.renderAll();
    };

    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  const panXRef = useRef(window.scrollX);
  const panYRef = useRef(window.scrollY);

  useEffect(() => {
    if (!fabricRef.current) return;

    panXRef.current = window.scrollX;
    panYRef.current = window.scrollY;

    // Function to update canvas panning
    const updateCanvasPan = () => {
      fabricRef.current.setZoom(fabricRef.current.getZoom());
      fabricRef.current.absolutePan({
        x: panXRef.current,
        y: panYRef.current,
      });
    };

    // Event listener for window scroll
    const handleScroll = () => {
      // Update canvas pan position based on scroll position
      panXRef.current = window.scrollX;
      panYRef.current = window.scrollY;
      updateCanvasPan();
    };

    updateCanvasPan();

    // Attach scroll event listener
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Cleanup function
    return () => {
      // Remove scroll event listener
      window.removeEventListener("scroll", handleScroll);

      // Reset canvas pan position
      panXRef.current = 0;
      panYRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (!fabricRef.current) return;

    const eraserDrawing = EraserTool(
      fabricRef.current,
      contentState,
      setContentState
    );

    const arrowDrawing = ArrowTool(
      fabricRef.current,
      contentState,
      setContentState,
      saveCanvas
    );

    const shapeDrawing = ShapeTool(
      fabricRef.current,
      contentState,
      setContentState,
      saveCanvas
    );
    const textDrawing = TextTool(
      fabricRef.current,
      contentState,
      setContentState,
      saveCanvas
    );
    const penDrawing = PenTool(
      fabricRef.current,
      contentState,
      setContentState,
      saveCanvas
    );

    return () => {
      arrowDrawing.removeEventListeners();
      eraserDrawing.removeEventListeners();
      shapeDrawing.removeEventListeners();
      textDrawing.removeEventListeners();
      penDrawing.removeEventListeners();
    };
  }, [contentState]);

  useEffect(() => {
    const selection = SelectTool(
      fabricRef.current,
      contentState,
      setContentState
    );
    const objectChanges = checkChanges(
      fabricRef.current,
      contentState,
      setContentState
    );

    return () => {
      selection.removeEventListeners();
      objectChanges.removeEventListeners();
    };
  }, [fabricRef, contentState]);

  useEffect(() => {
    // Prevent selecting elements unless in select mode
    if (!fabricRef.current) return;
    if (contentState.tool !== "select") {
      // De-select all objects on canvas
      fabricRef.current.discardActiveObject();

      fabricRef.current.selection = false;
      fabricRef.current.forEachObject((obj) => {
        obj.selectable = false;
      });
      fabricRef.current.renderAll();
    } else {
      fabricRef.current.selection = true;
      fabricRef.current.forEachObject((obj) => {
        obj.selectable = true;
      });
      fabricRef.current.renderAll();
    }
  }, [contentState.tool]);

  // handle what happens on key press
  const handleKeyPress = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "z")
      undoCanvas(contentState, setContentState);
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "z")
      redoCanvas(contentState, setContentState);
  };

  useEffect(() => {
    if (!fabricRef.current) return;
    // attach the event listener
    document.addEventListener("keydown", handleKeyPress);

    // remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress, fabricRef.current, contentState]);

  useEffect(() => {
    if (!fabricRef.current) return;

    // De-select all objects on canvas
    fabricRef.current.discardActiveObject();
    fabricRef.current.requestRenderAll();
  }, [contentState.drawingMode]);

  return (
    <div
      style={
        !contentState.drawingMode ||
        (contentState.hideToolbar && contentState.hideUI)
          ? { all: "unset", pointerEvents: "none" }
          : { all: "unset", pointerEvents: "all" }
      }
    >
      <div
        className="canvas-container"
        ref={canvasContainer}
        id="canvas-wrapper-screenity"
        style={{
          height: "100vh",
          width: "100vw",
          zIndex:
            contentState.drawingMode && !contentState.recording
              ? 99999999999
              : 99999999,
        }}
      >
        <canvas id="canvas-screenity" ref={canvasRef} className="canvas" />
      </div>
    </div>
  );
};

export default CanvasWrap;
