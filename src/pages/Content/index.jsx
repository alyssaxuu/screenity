import React from "react";
import { createRoot } from "react-dom/client";
import Content from "./Content";

// Idempotency guard: content script is injected via manifest AND re-injected
// by executeScripts() from onInstalled (every MV3 session start). Without
// this, both mounts orphan listeners and double-fire side effects (e.g.
// double start beeps).
if (window.__screenityContentBootstrapped) {
} else {
  window.__screenityContentBootstrapped = true;

  const existingRoot = document.getElementById("screenity-ui");
  if (existingRoot) {
    document.body.removeChild(existingRoot);
  }

  const root = document.createElement("div");
  root.id = "screenity-ui";
  document.body.appendChild(root);

  const appRoot = createRoot(root);
  appRoot.render(<Content />);
}
