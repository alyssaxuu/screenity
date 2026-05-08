import { perfMark } from "../utils/perfMarks";

// Distinguishes iframe-mount from message latency.
perfMark("Region.Recorder bundle.start");

import React from "react";
import { createRoot } from "react-dom/client";
import Recorder from "./Recorder";

const container = window.document.querySelector("#app-container");

if (container) {
  perfMark("Region.Recorder render.start");
  const root = createRoot(container);
  root.render(<Recorder />);
  perfMark("Region.Recorder render.dispatched");
}

if (module.hot) {
  module.hot.accept();
}
