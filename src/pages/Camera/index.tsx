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
interface ImportMetaWithWebpackHot extends ImportMeta {
  webpackHot?: {
    accept: () => void;
  };
}

const meta = import.meta as ImportMetaWithWebpackHot;
if (meta.webpackHot) {
  meta.webpackHot.accept();
}
