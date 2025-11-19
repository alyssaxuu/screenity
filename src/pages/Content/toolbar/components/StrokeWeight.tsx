import React from "react";

// Icons
import { Stroke1Icon, Stroke2Icon, Stroke3Icon } from "./SVG";
// Context
import { contentStateContext } from "../../context/ContentState";

// Components
import TooltipWrap from "./TooltipWrap";

import * as ToggleGroup from "@radix-ui/react-toggle-group";

const StrokeWeight = (props) => {
  const [contentState, setContentState] = React.useContext(contentStateContext);

  return (
    <React.Fragment>
      <TooltipWrap
        name="radial-menu-item stroke-width-item"
        override="tooltip-small"
        content={props.open ? chrome.i18n.getMessage("thickStrokeTooltip") : ""}
      >
        <span>
          <ToggleGroup.Item value={3} asChild>
            <div
              tabIndex={props.open ? "0" : "-1"}
              className="radial-menu-item-child"
            >
              <Stroke3Icon className="stroke-icon" />
            </div>
          </ToggleGroup.Item>
        </span>
      </TooltipWrap>
      <TooltipWrap
        name="radial-menu-item stroke-width-item"
        override="tooltip-small"
        content={
          props.open ? chrome.i18n.getMessage("mediumStrokeTooltip") : ""
        }
      >
        <span>
          <ToggleGroup.Item value={2} asChild>
            <div
              tabIndex={props.open ? "0" : "-1"}
              className="radial-menu-item-child"
            >
              <Stroke2Icon className="stroke-icon" />
            </div>
          </ToggleGroup.Item>
        </span>
      </TooltipWrap>
      <TooltipWrap
        name="radial-menu-item stroke-width-item"
        override="tooltip-small"
        content={props.open ? chrome.i18n.getMessage("thinStrokeTooltip") : ""}
      >
        <span>
          <ToggleGroup.Item value={1} asChild>
            <div
              tabIndex={props.open ? "0" : "-1"}
              className="radial-menu-item-child"
            >
              <Stroke1Icon className="stroke-icon" />
            </div>
          </ToggleGroup.Item>
        </span>
      </TooltipWrap>
    </React.Fragment>
  );
};

export default StrokeWeight;
