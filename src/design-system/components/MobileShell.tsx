"use client";

import React, { useRef, useState } from "react";

interface MobileShellProps {
  mapNode: React.ReactNode;
  sheetNode: React.ReactNode;
  activeDetent: "peek" | "medium" | "large";
  setActiveDetent: (detent: "peek" | "medium" | "large") => void;
}

export function MobileShell({
  mapNode,
  sheetNode,
  activeDetent,
  setActiveDetent
}: MobileShellProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; height: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Map detent states to percentage heights of viewport
  const getDetentHeight = (detent: "peek" | "medium" | "large") => {
    if (typeof window === "undefined") return 300;
    const vh = window.innerHeight;
    if (detent === "peek") return vh * 0.18;
    if (detent === "medium") return vh * 0.50;
    return vh * 0.92;
  };

  const currentHeight = dragHeight !== null ? dragHeight : getDetentHeight(activeDetent);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (sheetRef.current) {
      dragStartRef.current = {
        y: touch.clientY,
        height: sheetRef.current.getBoundingClientRect().height
      };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const touch = e.touches[0];
    const deltaY = dragStartRef.current.y - touch.clientY;
    const newHeight = Math.max(
      window.innerHeight * 0.12, 
      Math.min(window.innerHeight * 0.96, dragStartRef.current.height + deltaY)
    );
    setDragHeight(newHeight);
  };

  const handleTouchEnd = () => {
    if (!dragStartRef.current || dragHeight === null) {
      setIsDragging(false);
      return;
    }

    const vh = window.innerHeight;
    const peekH = vh * 0.18;
    const medH = vh * 0.50;
    const largeH = vh * 0.92;

    // Snapping logic
    let targetDetent: "peek" | "medium" | "large" = "medium";
    const dPeek = Math.abs(dragHeight - peekH);
    const dMed = Math.abs(dragHeight - medH);
    const dLarge = Math.abs(dragHeight - largeH);

    if (dPeek < dMed && dPeek < dLarge) {
      targetDetent = "peek";
    } else if (dLarge < dPeek && dLarge < dMed) {
      targetDetent = "large";
    } else {
      targetDetent = "medium";
    }

    setActiveDetent(targetDetent);
    setDragHeight(null);
    setIsDragging(false);
    dragStartRef.current = null;
  };

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-background">
      {/* Underlying Mapbox GL Canvas base layer */}
      <div className="absolute inset-0 z-0">
        {mapNode}
      </div>

      {/* Floating PWA Header */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto bg-surface/80 dark:bg-surface-elevated/80 backdrop-blur-md px-4 py-2 rounded-full shadow-sm text-sm font-semibold flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
          <span>Showing Yaba</span>
        </div>
      </div>

      {/* Swipeable Bottom Sheet layer */}
      <div
        ref={sheetRef}
        style={{ height: `${currentHeight}px` }}
        className={`absolute bottom-0 left-0 right-0 z-20 bg-surface/90 dark:bg-surface-elevated/90 backdrop-blur-lg rounded-t-[32px] shadow-2xl flex flex-col overflow-hidden ${
          isDragging ? "transition-none" : "transition-all duration-sheet ease-decelerate"
        }`}
      >
        {/* Continuous drag handle trigger */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full py-4 flex flex-col items-center justify-center cursor-row-resize select-none"
        >
          <div className="w-12 h-1.5 bg-text-tertiary/25 rounded-full" />
        </div>

        {/* Scrollable contents slot */}
        <div className="flex-1 overflow-y-auto pb-safe-bottom">
          {sheetNode}
        </div>
      </div>
    </div>
  );
}
