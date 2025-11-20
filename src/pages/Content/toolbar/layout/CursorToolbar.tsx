import React, { useState, useEffect, useContext } from "react";
import * as Toolbar from "@radix-ui/react-toolbar";
import TooltipWrap from "../components/TooltipWrap";

// Context
import { contentStateContext } from "../../context/ContentState";

// Icons
import {
  CursorIcon,
  TargetCursorIcon,
  HighlightCursorIcon,
  SpotlightCursorIcon,
  HideCursorIcon,
} from "../components/SVG";

const CursorToolbar = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);

  return (
    <Toolbar.Root
      className={"DrawingToolbar" + " " + props.visible}
      aria-label="Cursor options"
      tabIndex="0"
    >
      <Toolbar.ToggleGroup
        type="single"
        className="ToolbarToggleGroup"
        value={contentState.cursorMode}
        onValueChange={(value) => {
          if (value) {
            setContentState((prevContentState) => ({
              ...prevContentState,
              cursorMode: value,
            }));
            props.setMode(false);

            chrome.storage.local.set({
              cursorMode: value,
            });
          }
        }}
      >
        <TooltipWrap content="Default">
          <div className="ToolbarToggleWrap">
            <Toolbar.ToggleItem className="ToolbarToggleItem" value="none">
              <CursorIcon />
            </Toolbar.ToggleItem>
          </div>
        </TooltipWrap>
        <Toolbar.Separator className="ToolbarSeparator" />
        <TooltipWrap content={chrome.i18n.getMessage("highlightClicksTooltip")}>
          <div className="ToolbarToggleWrap">
            <Toolbar.ToggleItem className="ToolbarToggleItem" value="target">
              <TargetCursorIcon />
            </Toolbar.ToggleItem>
          </div>
        </TooltipWrap>
        <TooltipWrap content={chrome.i18n.getMessage("highlightCursorTooltip")}>
          <div className="ToolbarToggleWrap">
            <Toolbar.ToggleItem className="ToolbarToggleItem" value="highlight">
              <HighlightCursorIcon />
            </Toolbar.ToggleItem>
          </div>
        </TooltipWrap>
        <TooltipWrap content={chrome.i18n.getMessage("spotlightCursorTooltip")}>
          <div className="ToolbarToggleWrap">
            <Toolbar.ToggleItem className="ToolbarToggleItem" value="spotlight">
              <SpotlightCursorIcon />
            </Toolbar.ToggleItem>
          </div>
        </TooltipWrap>
      </Toolbar.ToggleGroup>
    </Toolbar.Root>
  );
};

export default CursorToolbar;
