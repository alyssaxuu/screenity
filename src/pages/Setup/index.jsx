import React from "react";
import { render } from "react-dom";

import Setup from "./Setup";

// Render at the end of the body of any website
render(<Setup />, window.document.querySelector("#app-container"));

if (module.hot) module.hot.accept();
