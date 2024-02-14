import React, { useEffect, useState, useContext, useRef } from "react";

import * as Toolbar from "@radix-ui/react-toolbar";
import ToolTrigger from "../components/ToolTrigger";

// Icons
import {
  RectangleIcon,
  CircleIcon,
  TriangleIcon,
  RectangleFilledIcon,
  CircleFilledIcon,
  TriangleFilledIcon,
} from "../components/SVG";

// Context
import { contentStateContext } from "../../context/ContentState";

const ShapeToolbar = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);

  return (
    <div
      aria-label="Cursor options"
      tabIndex="0"
      className={"shapeToolbar " + props.visible}
    >
      <Toolbar.ToggleGroup
        type="single"
        className="ToolbarToggleGroup"
        value={contentState.shape}
        onValueChange={(value) => {
          if (value)
            setContentState((prevContentState) => ({
              ...prevContentState,
              shape: value,
            }));
          chrome.storage.local.set({ shape: value });
        }}
      >
        <div className="ToolbarToggleWrap">
          <Toolbar.ToggleItem className="ToolbarToggleItem" value="rectangle">
            {contentState.shapeFill ? (
              <RectangleFilledIcon />
            ) : (
              <RectangleIcon />
            )}
          </Toolbar.ToggleItem>
        </div>
        <div className="ToolbarToggleWrap">
          <Toolbar.ToggleItem className="ToolbarToggleItem" value="circle">
            {contentState.shapeFill ? <CircleFilledIcon /> : <CircleIcon />}
          </Toolbar.ToggleItem>
        </div>
        <div className="ToolbarToggleWrap">
          <Toolbar.ToggleItem className="ToolbarToggleItem" value="triangle">
            {contentState.shapeFill ? <TriangleFilledIcon /> : <TriangleIcon />}
          </Toolbar.ToggleItem>
        </div>
      </Toolbar.ToggleGroup>
      <Toolbar.Separator className="ToolbarSeparator" />
      <ToolTrigger
        type="button"
        value="fill"
        content={chrome.i18n.getMessage("toggleFillTooltip")}
        onClick={() => {
          setContentState((prevContentState) => ({
            ...prevContentState,
            shapeFill: !contentState.shapeFill,
          }));
          chrome.storage.local.set({ shapeFill: !contentState.shapeFill });
        }}
      >
        {contentState.shape === "rectangle" && contentState.shapeFill ? (
          <RectangleIcon />
        ) : contentState.shape === "circle" && contentState.shapeFill ? (
          <CircleIcon />
        ) : contentState.shape === "triangle" && contentState.shapeFill ? (
          <TriangleIcon />
        ) : contentState.shape === "rectangle" && !contentState.shapeFill ? (
          <RectangleFilledIcon />
        ) : contentState.shape === "circle" && !contentState.shapeFill ? (
          <CircleFilledIcon />
        ) : contentState.shape === "triangle" && !contentState.shapeFill ? (
          <TriangleFilledIcon />
        ) : null}
      </ToolTrigger>
    </div>
  );
};

export default ShapeToolbar;
