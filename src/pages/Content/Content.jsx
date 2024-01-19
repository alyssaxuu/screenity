import React, { useState, useContext, useEffect, useRef } from "react";

// Components
import Wrapper from "./Wrapper";

// Context
import ContentState from "./context/ContentState";

const Content = () => {
  return (
    <div className="screenity-shadow-dom">
      <ContentState>
        <Wrapper />
      </ContentState>
      <style type="text/css">{`
			#screenity-ui, #screenity-ui div {
				background-color: unset;
				padding: unset;
				width: unset;
				box-shadow: unset;
				display: unset;
				margin: unset;
				border-radius: unset;
			}
			.screenity-outline {
				position: absolute;
				z-index: 99999999999;
				border: 2px solid #3080F8;
				outline-offset: -2px;
				pointer-events: none;
				border-radius: 5px!important;
			}
		.screenity-blur {
			filter: blur(10px)!important;
		}
			.screenity-shadow-dom * {
				transition: unset;
			}
			.screenity-shadow-dom .TooltipContent {
  border-radius: 30px!important;
	background-color: #29292F!important;
  padding: 10px 15px!important;
  font-size: 12px;
	margin-bottom: 10px!important;
	bottom: 100px;
  line-height: 1;
	font-family: 'Satoshi-Medium', sans-serif;
	z-index: 99999999!important;
  color: #FFF;
  box-shadow: hsl(206 22% 7% / 35%) 0px 10px 38px -10px, hsl(206 22% 7% / 20%) 0px 10px 20px -15px!important;
  user-select: none;
	transition: opacity 0.3 ease-in-out;
  will-change: transform, opacity;
	animation-duration: 400ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
}

.screenity-shadow-dom .hide-tooltip {
	display: none!important;
}

.screenity-shadow-dom .tooltip-tall {
	margin-bottom: 20px;
}

.screenity-shadow-dom .tooltip-small {
	margin-bottom: 5px;
}

.screenity-shadow-dom .TooltipContent[data-state='delayed-open'][data-side='top'] {
	animation-name: slideDownAndFade;
}
.screenity-shadow-dom .TooltipContent[data-state='delayed-open'][data-side='right'] {
  animation-name: slideLeftAndFade;
}
.screenity-shadow-dom.TooltipContent[data-state='delayed-open'][data-side='bottom'] {
  animation-name: slideUpAndFade;
}
.screenity-shadow-dom.TooltipContent[data-state='delayed-open'][data-side='left'] {
  animation-name: slideRightAndFade;
}

@keyframes slideUpAndFade {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideRightAndFade {
  from {
    opacity: 0;
    transform: translateX(-2px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideDownAndFade {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideLeftAndFade {
  from {
    opacity: 0;
    transform: translateX(2px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

[data-radix-popper-content-wrapper] { z-index: 999999999999!important; } 

.screenity-shadow-dom .CanvasContainer {
	position: fixed;
	pointer-events: all!important;
	top: 0px!important;
	left: 0px!important;
	z-index: 99999999999!important;
}
.screenity-shadow-dom .canvas {
	position: fixed;
	top: 0px!important;
	left: 0px!important;
	z-index: 99999999999!important;
	background: transparent!important;
}
.screenity-shadow-dom .canvas-container {
	top: 0px!important;
	left: 0px!important;
	z-index: 99999999999;
	position: fixed!important;
	background: transparent!important;
}

`}</style>
    </div>
  );
};

export default Content;
