import React, { useRef, useContext, useEffect, useState } from "react";

import * as Toolbar from "@radix-ui/react-toolbar";
import * as Select from "@radix-ui/react-select";

// Context
import { contentStateContext } from "../../context/ContentState";

const TextToolbar = (props) => {
  const toolbarRef = useRef(null);
  const [contentState, setContentState] = useContext(contentStateContext);
  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (!contentState.canvas) return;

    const canvas = contentState.canvas;
    const toolbar = toolbarRef.current;

    function positionToolbarOnTextbox(textbox) {
      // place the toolbar on top of the textbox, centered, with a vertical offset
      const textCoords = textbox.getBoundingRect();
      const textOffset = textCoords.left;
      const textWidth = textCoords.width;
      const textHeight = textCoords.height;
      const textTop = textCoords.top;
      const textLeft = textCoords.left;
      const textCenter = textLeft + textWidth / 2;
      const textCenterOffset = textCenter;
      const toolbarWidth = toolbar.clientWidth;
      const toolbarHeight = toolbar.clientHeight;
      const toolbarLeft = textCenterOffset - toolbarWidth / 2;
      const toolbarTop = textTop - toolbarHeight - 10;
      setLeft(toolbarLeft);
      setTop(toolbarTop);
    }

    function hideToolbar() {
      toolbar.style.display = "none";
    }

    canvas.on("selection:created", function (e) {
      const selectedObject = canvas.getActiveObject();
      if (selectedObject === null || selectedObject === undefined) return;

      if (selectedObject.type === "textbox") {
        positionToolbarOnTextbox(selectedObject);
      }
    });

    canvas.on("selection:cleared", function () {
      hideToolbar();
    });

    canvas.on("object:moving", function (e) {
      const movedObject = e.target;

      if (
        movedObject.type === "textbox" &&
        canvas.getActiveObject() === movedObject
      ) {
        positionToolbarOnTextbox(movedObject);
      }
    });

    canvas.on("object:scaling", function (e) {
      const resizedObject = e.target;

      if (
        resizedObject.type === "textbox" &&
        canvas.getActiveObject() === resizedObject
      ) {
        positionToolbarOnTextbox(resizedObject);
      }
    });
  }, [contentState.canvas]);

  return (
    <div
      className="text-toolbar"
      ref={toolbarRef}
      style={{
        left: left + "px",
        top: top + "px",
        position: "absolute",
        backgroundColor: "black",
        borderRadius: "10px",
        padding: "10px",
        color: "white",
        display: "block",
      }}
    >
      oioi
    </div>
  );
};

export default TextToolbar;
