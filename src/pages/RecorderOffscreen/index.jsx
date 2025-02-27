import React from "react";
import { render } from "react-dom";

import RecorderOffscreen from "./RecorderOffscreen";

// Render at the end of the body of any website
render(<RecorderOffscreen />, window.document.querySelector("#app-container"));

if (module.hot) module.hot.accept();
