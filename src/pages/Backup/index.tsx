import React from "react";
import { createRoot } from "react-dom/client";

import Backup from "./Backup";

// Find the container to render into
const container = window.document.querySelector("#app-container");

if (container) {
  const root = createRoot(container);
  root.render(<Backup />);
}

// Hot Module Replacement
declare const module: {
  hot?: {
    accept(): void;
  };
};

if (module.hot) {
  module.hot.accept();
}
