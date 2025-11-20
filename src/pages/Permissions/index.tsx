import React from "react";
import { createRoot } from "react-dom/client";
import Recorder from "./Permissions";

// Find the container to render into
const container = window.document.querySelector("#app-container");

if (container) {
  const root = createRoot(container);
  root.render(<Recorder />);
}

// Hot Module Replacement
if (module.hot) {
  module.hot.accept();
}
