// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import CameraProvider from "./context/CameraContext";
import Camera from "./Camera";

// Find the container to render into
const container = window.document.querySelector("#app-container");

if (container) {
  const root = createRoot(container);
  root.render(
    <CameraProvider>
      <Camera />
    </CameraProvider>
  );
}

// Hot Module Replacement
if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
