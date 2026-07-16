"use client";

import React from "react";
import { MobileShell } from "./MobileShell";
import { DesktopTabletShell } from "./DesktopTabletShell";

interface AdaptiveShellProps {
  mapNode: React.ReactNode;
  sheetNode: React.ReactNode;
  detailNode?: React.ReactNode;
  activeDetent: "peek" | "medium" | "large";
  setActiveDetent: (detent: "peek" | "medium" | "large") => void;
}

export function AdaptiveShell({
  mapNode,
  sheetNode,
  detailNode,
  activeDetent,
  setActiveDetent
}: AdaptiveShellProps) {
  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-background">
      {/* 
        Persistent Global Map Layer:
        Mounted once in the DOM at the root base level (z-0).
        This guarantees the WebGL context is preserved when switching 
        between mobile swipe-up sheets and desktop sidebars.
      */}
      <div className="absolute inset-0 z-0">
        {mapNode}
      </div>

      {/* 
        Responsive Layout Manager:
        Toggles overlay structures based on Tailwind CSS breakpoints
      */}

      {/* Mobile Shell Overlay (< md) */}
      <div className="block md:hidden absolute inset-0 z-10 pointer-events-none">
        <div className="pointer-events-auto w-full h-full">
          <MobileShell
            mapNode={null} // Map is rendered globally at base layer
            sheetNode={sheetNode}
            activeDetent={activeDetent}
            setActiveDetent={setActiveDetent}
          />
        </div>
      </div>

      {/* Desktop/Tablet Shell Overlay (>= md) */}
      <div className="hidden md:block absolute inset-0 z-10 pointer-events-none">
        <div className="pointer-events-auto w-full h-full">
          <DesktopTabletShell
            mapNode={null} // Map is rendered globally at base layer
            sheetNode={sheetNode}
            detailNode={detailNode}
          />
        </div>
      </div>
    </div>
  );
}
