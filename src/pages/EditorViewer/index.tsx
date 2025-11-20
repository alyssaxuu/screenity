import React from "react";
import { createRoot } from "react-dom/client";
import Sandbox from "./Sandbox";
import "./index.css";

const container = document.querySelector("#app-container");
const root = createRoot(container);
root.render(<Sandbox />);
