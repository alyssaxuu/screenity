import React from "react";
import { createRoot } from "react-dom/client";
import Download from "./Download";
import HeldTakes from "./HeldTakes";

// Find the container to render into
const container = window.document.querySelector("#app-container");

if (container) {
  const root = createRoot(container);
  const heldView = new URLSearchParams(window.location.search).get("held") === "1";
  root.render(heldView ? <HeldTakes /> : <Download />);
}

// Hot Module Replacement
if (module.hot) {
  module.hot.accept();
}
