import React, { useState, useContext, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";

// Context
import { contentStateContext } from "../../context/ContentState";

const ResizableBox = () => {
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 999999999,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 9999999999,
          }}
          className="box-hole"
        />
      </div>
      <Rnd
        ref={regionRef}
        style={{ position: "fixed", zIndex: 9999999999 }}
        default={{
          x: 0,
          y: 0,
          width: 200,
          height: 200,
        }}
        minWidth={100}
        minHeight={100}
        resizeHandleWrapperClass="resize-handle-wrapper"
        resizeHandleComponent={{
          topLeft: (
            <div
              style={{
                position: "absolute",
                top: "0px",
                left: "0px",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "white",
                border: "2px solid black",
                cursor: "nwse-resize",
                boxSizing: "border-box",
              }}
            />
          ),
          top: (
            <div
              style={{
                position: "absolute",
                top: "0px",
                left: "50%",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "white",
                border: "2px solid black",
                cursor: "ns-resize",
                boxSizing: "border-box",
              }}
            />
          ),
          topRight: (
            <div
              style={{
                position: "absolute",
                top: "0px",
                right: "0px",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "white",
                border: "2px solid black",
                cursor: "nesw-resize",
                boxSizing: "border-box",
              }}
            />
          ),
          right: (
            <div
              style={{
                position: "absolute",
                top: "50%",
                right: "0px",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "white",
                border: "2px solid black",
                cursor: "ew-resize",
                boxSizing: "border-box",
              }}
            />
          ),
          bottomRight: (
            <div
              style={{
                position: "absolute",
                bottom: "0px",
                right: "0px",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "white",
                border: "2px solid black",
                cursor: "nwse-resize",
                boxSizing: "border-box",
              }}
            />
          ),
          bottom: (
            <div
              style={{
                position: "absolute",
                bottom: "0px",
                left: "50%",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "white",
                border: "2px solid black",
                cursor: "ns-resize",
                boxSizing: "border-box",
              }}
            />
          ),
          bottomLeft: (
            <div
              style={{
                position: "absolute",
                bottom: "0px",
                left: "0px",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "white",
                border: "2px solid black",
                cursor: "nesw-resize",
                boxSizing: "border-box",
              }}
            />
          ),
          left: (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "0px",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "white",
                border: "2px solid black",
                cursor: "ew-resize",
                boxSizing: "border-box",
              }}
            />
          ),
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            border: "2px dashed white",
            borderRadius: "5px",
            zIndex: 9999999999,
            boxSizing: "border-box",
          }}
        />
      </Rnd>
    </div>
  );
};

export default ResizableBox;
