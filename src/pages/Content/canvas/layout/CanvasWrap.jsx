import React, { useEffect, useRef, useContext } from "react";
import { fabric } from "fabric";

import { contentStateContext } from "../../context/ContentState";

import CustomControls from "../modules/CustomControls";

import ArrowTool from "../modules/ArrowTool";
import EraserTool from "../modules/EraserTool";
import ShapeTool from "../modules/ShapeTool";
import TextTool from "../modules/TextTool";
import PenTool from "../modules/PenTool";
import SelectTool from "../modules/SelectTool";

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
      setContentState,
    );
  }, []);

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

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const tool = contentState.tool;

    const shouldDraw =
      contentState.drawingMode && (tool === "pen" || tool === "highlighter");

    canvas.isDrawingMode = shouldDraw;

    // Important: when leaving pen/highlighter, clear any in-progress brush stroke
    if (!shouldDraw && canvas.freeDrawingBrush) {
      const brush = canvas.freeDrawingBrush;
      if (Array.isArray(brush._points)) brush._points.length = 0;
      if (Array.isArray(brush.points)) brush.points.length = 0;
      if (typeof brush._reset === "function") brush._reset();
    }

    canvas.requestRenderAll();
  }, [contentState.tool, contentState.drawingMode]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Only discard selection when leaving select (or when entering a drawing tool)
    if (contentState.tool !== "select") {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }, [contentState.tool]);

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

    const canvas = fabricRef.current;

    // Pass a ref getter instead of snapshot state
    const arrowDrawing = ArrowTool(
      canvas,
      contentStateRef,
      setContentState,
      saveCanvas,
    );
    const eraserDrawing = EraserTool(canvas, contentStateRef, setContentState);
    const shapeDrawing = ShapeTool(
      canvas,
      contentStateRef,
      setContentState,
      saveCanvas,
    );
    const textDrawing = TextTool(
      canvas,
      contentStateRef,
      setContentState,
      saveCanvas,
    );
    const penDrawing = PenTool(
      canvas,
      contentStateRef,
      setContentState,
      saveCanvas,
    );

    return () => {
      arrowDrawing.removeEventListeners();
      eraserDrawing.removeEventListeners();
      shapeDrawing.removeEventListeners();
      textDrawing.removeEventListeners();
      penDrawing.removeEventListeners();
    };
  }, []);

  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;

    const selection = SelectTool(canvas, contentStateRef, setContentState);
    const objectChanges = checkChanges(
      canvas,
      contentStateRef,
      setContentState,
    );

    return () => {
      selection.removeEventListeners();
      objectChanges.removeEventListeners();
    };
  }, []);

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

  useEffect(() => {
    const onKeyDown = (event) => {
      const state = contentStateRef.current;
      if (!state) return;

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey
      ) {
        undoCanvas(state, setContentState);
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "y" ||
          (event.shiftKey && event.key.toLowerCase() === "z"))
      ) {
        redoCanvas(state, setContentState);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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
