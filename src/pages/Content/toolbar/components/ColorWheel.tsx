import React, { useRef, useState, useContext } from "react";

import Wheel from "@uiw/react-color-wheel";
import { hsvaToHex } from "@uiw/color-convert";

// Components
import TooltipWrap from "./TooltipWrap";

// Context
import { contentStateContext } from "../../context/ContentState";

const ColorWheel = (props) => {
  const [hsva, setHsva] = React.useState({ h: 200, s: 50, v: 100, a: 1 });
  const [contentState, setContentState] = useContext(contentStateContext);
  const wheelRef = useRef(null);
  const stateRef = useRef();

  stateRef.current = props.fullwheel;

  const handleClick = (e) => {
    if (!props.fullwheel) {
      props.setFullWheel(true);
    }
  };

  return (
    <TooltipWrap
      content={chrome.i18n.getMessage("moreColorsTooltip")}
      name="wheel-trigger"
      override="tooltip-small"
      hide={props.fullwheel ? "hide-tooltip" : ""}
    >
      <div
        className={
          contentState.swatch === 5
            ? "radial-menu-item-child color-active"
            : "radial-menu-item-child"
        }
        onClick={handleClick}
        style={
          contentState.swatch === 5
            ? { backgroundColor: contentState.color }
            : {}
        }
        ref={wheelRef}
        tabIndex={props.open ? "0" : "-1"}
      >
        <div className="color-wheel-input">
          {contentState.color.toUpperCase()}
        </div>
        <div
          className="color-preview"
          style={{ backgroundColor: contentState.color }}
        ></div>
        <Wheel
          color={hsva}
          width={100}
          height={100}
          onChange={(color) => {
            setHsva({ ...hsva, ...color.hsva });
            setContentState((prevContentState) => ({
              ...prevContentState,
              color: hsvaToHex({ h: hsva.h, s: hsva.s, v: hsva.v, a: hsva.a }),
              swatch: 5,
            }));
            chrome.storage.local.set({
              color: hsvaToHex({ h: hsva.h, s: hsva.s, v: hsva.v, a: hsva.a }),
              swatch: 5,
            });
          }}
        />
      </div>
    </TooltipWrap>
  );
};

export default ColorWheel;
