import React from "react";
import { render } from "react-dom";

import Download from "./Download";

// Render at the end of the body of any website
render(<Download />, window.document.querySelector("#app-container"));

if (module.hot) module.hot.accept();
