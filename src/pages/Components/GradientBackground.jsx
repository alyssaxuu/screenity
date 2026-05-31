import React from "react";

const GradientBackground = ({ subtle = false }) => {
  const waveMask =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><path d='M 0 0 L 100 0 L 100 84 C 92 77 68 77 50 84 C 32 91 8 91 0 84 Z' fill='black'/></svg>\")";
  return (
    <div
      className={
        "screenity-wave-bg" + (subtle ? " screenity-wave-bg--subtle" : "")
      }
      aria-hidden="true"
    >
      <style>
        {`
          .screenity-wave-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            pointer-events: none;
            z-index: -1;
            background-color: #FAFBFE;
          }
          .screenity-wave-bg::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 98vh;
            pointer-events: none;
            opacity: 0.55;
            background:
              radial-gradient(ellipse 220% 200% at 30% -120%, transparent 72%, rgba(43, 174, 248, 0.16) 88%, transparent 100%),
              radial-gradient(ellipse 220% 200% at 70% -120%, transparent 72%, rgba(47, 125, 240, 0.2) 88%, transparent 100%);
            -webkit-mask-image: ${waveMask};
            mask-image: ${waveMask};
            -webkit-mask-size: 100% 100%;
            mask-size: 100% 100%;
            -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
          }
          .screenity-wave-bg--subtle::before {
            opacity: 0.28;
          }
        `}
      </style>
    </div>
  );
};

export default GradientBackground;
