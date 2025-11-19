import React from "react";
import { createRoot } from "react-dom/client";
import Content from "./Content";

// Check if screenity-ui already exists, if so, remove it
const existingRoot = document.getElementById("screenity-ui");
if (existingRoot) {
  document.body.removeChild(existingRoot);
}

const root = document.createElement("div");
root.id = "screenity-ui";
document.body.appendChild(root);

const appRoot = createRoot(root);
appRoot.render(<Content />);
