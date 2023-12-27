import React from "react";
import { render } from "react-dom";

import Waveform from "./Waveform";

// Render at the end of the body of any website
render(<Waveform />, window.document.querySelector("#app-container"));

if (module.hot) module.hot.accept();
