"use client";

import React from "react";

interface DesktopTabletShellProps {
  mapNode: React.ReactNode;
  sheetNode: React.ReactNode;
  detailNode?: React.ReactNode;
}

export function DesktopTabletShell({
  mapNode,
  sheetNode,
  detailNode
}: DesktopTabletShellProps) {
  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-background">
      {/* 1. Underlying Mapbox GL Canvas layer */}
      <div className="absolute inset-0 z-0">
        {mapNode}
      </div>

      {/* 2. Floating Left Panel (Tablet: 380px wide | Desktop: 420px wide) */}
      <div className="absolute top-4 bottom-4 left-4 lg:top-6 lg:bottom-6 lg:left-6 z-10 w-[380px] lg:w-[420px] bg-surface/85 dark:bg-surface-elevated/85 backdrop-blur-lg rounded-[28px] shadow-2xl overflow-hidden flex flex-col transition-all duration-standard border-0">
        <div className="flex-1 overflow-y-auto">
          {sheetNode}
        </div>
      </div>

      {/* 3. Floating Right Detail Panel (Rendered dynamically if details exist) */}
      {detailNode && (
        <div className="absolute top-4 bottom-4 right-4 lg:top-6 lg:bottom-6 lg:right-6 z-10 w-[340px] lg:w-[380px] bg-surface/85 dark:bg-surface-elevated/85 backdrop-blur-lg rounded-[28px] shadow-2xl overflow-hidden flex flex-col transition-all duration-standard border-0 animate-fade-in">
          <div className="flex-1 overflow-y-auto p-6">
            {detailNode}
          </div>
        </div>
      )}
    </div>
  );
}
