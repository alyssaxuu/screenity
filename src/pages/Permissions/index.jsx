import React from "react";
import { render } from "react-dom";

import Recorder from "./Permissions";

// Render at the end of the body of any website
render(<Recorder />, window.document.querySelector("#app-container"));

if (module.hot) module.hot.accept();
