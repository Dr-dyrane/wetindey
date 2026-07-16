"use client";

import React, { useId } from "react";
import {
  LOGO_VIEWBOX,
  NIGERIA_PATH,
  NIGERIA_TRANSFORM,
  QUESTION_PATH,
  QUESTION_TRANSFORM,
} from "@/design-system/brand/logoGeometry";

interface NigeriaLogoProps {
  className?: string;
  fillColor?: string;
}

export function NigeriaLogo({
  className = "h-7 w-7",
  fillColor = "fill-text-primary dark:fill-white",
}: NigeriaLogoProps) {
  // Use unique ID to prevent collisions on duplicate SVG instances
  const maskId = useId();

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      {/* Nigeria map silhouette with a hollow question mark cut out of it */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={LOGO_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="WetinDey"
        className={`w-full h-full ${fillColor}`}
      >
        <defs>
          <mask id={maskId}>
            {/* White keeps the silhouette, black knocks the question mark out of it */}
            <rect x="0" y="0" width="1024" height="1024" fill="white" />
            <g transform={QUESTION_TRANSFORM}>
              <path d={QUESTION_PATH} fill="black" />
            </g>
          </mask>
        </defs>

        <g mask={`url(#${maskId})`}>
          <g transform={NIGERIA_TRANSFORM}>
            <path d={NIGERIA_PATH} />
          </g>
        </g>
      </svg>
    </div>
  );
}
