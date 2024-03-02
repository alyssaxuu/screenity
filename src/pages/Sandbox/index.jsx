import React from "react";
import { render } from "react-dom";

import Sandbox from "./Sandbox";

import ContentState from "./context/ContentState";

// Render at the end of the body of any website
render(
  <ContentState>
    <Sandbox />
  </ContentState>,
  window.document.querySelector("#app-container")
);

if (module.hot) module.hot.accept();
