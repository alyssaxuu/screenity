import React, {
  useRef,
  useEffect,
  useCallback,
  useContext,
  useState,
} from "react";
import * as Toolbar from "@radix-ui/react-toolbar";

// Components
import ToolTrigger from "../components/ToolTrigger";
import RadialMenu from "../components/RadialMenu";
import ShapeToolbar from "./ShapeToolbar";

// Canvas utils
import {
  undoCanvas,
  redoCanvas,
  saveCanvas,
} from "../../canvas/modules/History";

// Icons
import {
  DrawIcon,
  EraserIcon,
  ArrowIcon,
  ImageIcon,
  UndoIcon,
  RedoIcon,
  TransformIcon,
  HighlighterIcon,
  TextIcon,
  RectangleIcon,
  TriangleIcon,
  CircleIcon,
  RectangleFilledIcon,
  CircleFilledIcon,
  TriangleFilledIcon,
  TrashIcon,
} from "../components/SVG";

// Rewrite imports above with the chrome-extension URL inline

import TooltipWrap from "../components/TooltipWrap";
import ImageTool from "../../canvas/modules/ImageTool";

// Context
import { contentStateContext } from "../../context/ContentState";

const DrawingToolbar = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [tool, setTool] = useState("");

  const imageFileInput = useRef(null);

  useEffect(() => {
    setTool(contentState.tool);
  }, [contentState.tool]);

  const handleImageChange = useCallback(
    (e) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setContentState((prevContentState) => ({
          ...prevContentState,
          isAddingImage: true,
        }));

        // De-select all objects
        contentState.canvas.discardActiveObject();
        contentState.canvas.requestRenderAll();

        // Make all objects unselectable
        contentState.canvas.forEachObject((obj) => {
          obj.selectable = false;
        });

        const imgTool = ImageTool(
          contentState.canvas,
          e.target.result,
          contentState,
          setContentState,
          saveCanvas
        );

        imageFileInput.current.value = "";

        return () => {
          imgTool.removeEventListeners();
        };
      };

      reader.readAsDataURL(e.target.files[0]);
    },
    [contentState, setContentState, saveCanvas]
  );

  return (
    <Toolbar.Root
      className={"DrawingToolbar" + " " + props.visible}
      aria-label="Drawing tools"
    >
      <Toolbar.ToggleGroup
        type="single"
        className="ToolbarToggleGroup"
        value={tool}
        onValueChange={(value) => {
          if (value)
            setContentState((prevContentState) => ({
              ...prevContentState,
              tool: value,
            }));
        }}
      >
        <ToolTrigger
          type="toggle"
          value="select"
          content={chrome.i18n.getMessage("selectToolTooltip")}
        >
          <TransformIcon />
        </ToolTrigger>
        <ToolTrigger
          type="toggle"
          value="pen"
          content={chrome.i18n.getMessage("penToolTooltip")}
        >
          <DrawIcon />
        </ToolTrigger>
        <ToolTrigger
          type="toggle"
          value="highlighter"
          content={chrome.i18n.getMessage("highlighterToolTooltip")}
        >
          <HighlighterIcon />
        </ToolTrigger>
        <ToolTrigger
          type="toggle"
          value="eraser"
          content={chrome.i18n.getMessage("eraserToolTooltip")}
        >
          <EraserIcon />
        </ToolTrigger>
        <RadialMenu />
        <ToolTrigger
          type="toggle"
          value="text"
          content={chrome.i18n.getMessage("textToolTooltip")}
        >
          <TextIcon />
        </ToolTrigger>
        <ShapeToolbar visible={tool === "shape" ? "show-toolbar" : ""} />
        <ToolTrigger
          type="toggle"
          value="shape"
          content={chrome.i18n.getMessage("shapeToolTooltip")}
        >
          {contentState.shape === "rectangle" && contentState.shapeFill ? (
            <RectangleFilledIcon />
          ) : contentState.shape === "circle" && contentState.shapeFill ? (
            <CircleFilledIcon />
          ) : contentState.shape === "triangle" && contentState.shapeFill ? (
            <TriangleFilledIcon />
          ) : contentState.shape === "rectangle" && !contentState.shapeFill ? (
            <RectangleIcon />
          ) : contentState.shape === "circle" && !contentState.shapeFill ? (
            <CircleIcon />
          ) : contentState.shape === "triangle" && !contentState.shapeFill ? (
            <TriangleIcon />
          ) : null}
        </ToolTrigger>
        <ToolTrigger
          type="toggle"
          value="arrow"
          content={chrome.i18n.getMessage("arrowToolTooltip")}
        >
          <ArrowIcon />
        </ToolTrigger>
        <ToolTrigger
          type="button"
          value="image"
          content={chrome.i18n.getMessage("imageToolTooltip")}
          onClick={(e) => imageFileInput.current.click()}
        >
          <ImageIcon />
          <input
            type="file"
            id="file"
            accept="image/*"
            style={{ display: "none" }}
            ref={imageFileInput}
            onChange={handleImageChange}
          />
        </ToolTrigger>
      </Toolbar.ToggleGroup>
      <Toolbar.Separator className="ToolbarSeparator" />
      <ToolTrigger
        type="button"
        content={chrome.i18n.getMessage("undoTooltip")}
        disabled={contentState.undoStack.length === 0 ? true : false}
        onClick={() => undoCanvas(contentState, setContentState)}
      >
        <UndoIcon />
      </ToolTrigger>
      <ToolTrigger
        type="button"
        content={chrome.i18n.getMessage("redoTooltip")}
        disabled={contentState.redoStack.length === 0 ? true : false}
        onClick={() => redoCanvas(contentState, setContentState)}
      >
        <RedoIcon />
      </ToolTrigger>
      <ToolTrigger
        type="button"
        content={chrome.i18n.getMessage("clearCanvasTooltip")}
        disabled={
          contentState.canvas
            ? contentState.canvas.getObjects().length === 0
              ? true
              : false
            : true
        }
        onClick={() => {
          if (!contentState.canvas) return;

          contentState.canvas.clear();
          contentState.canvas.renderAll();
          contentState.canvas.requestRenderAll();
          saveCanvas(contentState, setContentState);
        }}
      >
        <TrashIcon />
      </ToolTrigger>
    </Toolbar.Root>
  );
};

export default DrawingToolbar;
