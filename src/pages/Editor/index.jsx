import React from "react";
import { createRoot } from "react-dom/client";

// editor renders directly in editor.html (no sandbox.html iframe); heavy mediabunny ops run in-process via editorOps
import ContentState from "../EditorApp/context/ContentState";
import EditorApp from "../EditorApp/EditorApp";
import EditorPageBridge from "../EditorApp/EditorPageBridge";

// Find the container to render into
const container = window.document.querySelector("#app-container");

if (container) {
  const root = createRoot(container);
  root.render(
    <ContentState>
      <EditorApp />
      <EditorPageBridge />
    </ContentState>
  );
}

// Hot Module Replacement
if (module.hot) {
  module.hot.accept();
}
