import React from "react";
import { createRoot } from "react-dom/client";
import CloudRecorder from "./CloudRecorder";

// Find the container to render into
const container = window.document.querySelector("#app-container");

if (container) {
  const root = createRoot(container);
  root.render(<CloudRecorder />);
}

// Hot Module Replacement
import type { Module } from "webpack";

interface NodeModuleWithHot extends NodeModule {
  hot?: {
    accept: () => void;
  };
}

if ((module as NodeModuleWithHot).hot) {
  (module as NodeModuleWithHot).hot?.accept();
}
