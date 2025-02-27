import React from "react";
import { render } from "react-dom";

import Sandbox from "./Sandbox";

// Render at the end of the body of any website
render(<Sandbox />, window.document.querySelector("#app-container"));

if (module.hot) module.hot.accept();
