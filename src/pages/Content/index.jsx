import React from "react";
import { render } from "react-dom";
import Content from "./Content";

// Check if screenity-ui already exists, if so, remove it
const existingRoot = document.getElementById("screenity-ui");
if (existingRoot) {
  document.body.removeChild(existingRoot);
}

const root = document.createElement("div");
root.id = "screenity-ui";
document.body.appendChild(root);
render(<Content />, root);
