"use client";

import React from "react";

interface ContextLayoutProps {
  mapNode: React.ReactNode;
  sheetNode: React.ReactNode;
  isMobileListActive: boolean;
}

export function ContextLayout({
  mapNode,
  sheetNode,
  isMobileListActive
}: ContextLayoutProps) {
  return (
    <div className="relative w-full h-full min-h-screen flex flex-col md:flex-row overflow-hidden bg-background text-text-primary">
      {/* 
        Persistent Map Wrapper: 
        Maintained in the DOM at all times to prevent WebGL canvas re-initialization.
        We adjust visibility via CSS classes ('hidden' or absolute layouts) instead of React unmounting.
      */}
      <div
        className={`relative flex-1 h-full w-full pt-16 md:block transition-all duration-standard ${
          isMobileListActive ? "hidden" : "block"
        }`}
      >
        {mapNode}
      </div>

      {/* 
        Persistent Context Sheet Wrapper: 
        Desktop: Left side panel.
        Mobile: Bottom slide-up panel or list view.
      */}
      <div
        className={`w-full md:w-[420px] bg-surface/95 dark:bg-surface-elevated/95 backdrop-blur border-0 z-20 flex flex-col transition-all duration-sheet shadow-2xl md:shadow-lg ${
          isMobileListActive ? "flex-1 h-full pt-16" : "h-[45vh] md:h-screen pt-16 md:pt-0"
        }`}
      >
        {sheetNode}
      </div>
    </div>
  );
}
