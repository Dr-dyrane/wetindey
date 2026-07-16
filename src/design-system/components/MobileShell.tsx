"use client";

import React from "react";
import { BottomSheet, type Detent } from "./BottomSheet";

interface MobileShellProps {
  mapNode: React.ReactNode;
  sheetNode: React.ReactNode;
  activeDetent: Detent;
  setActiveDetent: (detent: Detent) => void;
}

export function MobileShell({ mapNode, sheetNode, activeDetent, setActiveDetent }: MobileShellProps) {
  return (
    // No background here. AdaptiveShell renders the map underneath this layer,
    // so anything opaque at this level hides the map entirely.
    <div className="relative w-full h-full">
      {mapNode ? <div className="absolute inset-0 z-0">{mapNode}</div> : null}

      <BottomSheet detent={activeDetent} onDetentChange={setActiveDetent}>
        {sheetNode}
      </BottomSheet>
    </div>
  );
}
