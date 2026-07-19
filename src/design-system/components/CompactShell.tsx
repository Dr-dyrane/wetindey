"use client";

import React, { useEffect, useRef } from "react";
import { BottomSheet, type Detent, type LiveSheetInset } from "./BottomSheet";
import { NavigationStack } from "./NavigationStack";

interface CompactShellProps {
  listNode: React.ReactNode;
  detailNode?: React.ReactNode;
  detailLabel?: string;
  onDetailBack?: () => void;
  backLabel?: string;
  activeDetent: Detent;
  setActiveDetent: (detent: Detent) => void;
  onLiveInsetChange: (inset: LiveSheetInset | null) => void;
}

/**
 * Compact width: results ride a draggable sheet over the map.
 *
 * The sheet exists here and not in the regular shell for one reason — at
 * compact width the map and the list contend for the same ~390px, so the list
 * must be able to get out of the way. Three detents are how you trade map for
 * list when you cannot have both. Where you can have both, a control that
 * trades between them has nothing to control.
 *
 * Detail is NOT a second surface here. It is level 1 of the same stack the
 * regular shell uses, pushed inside the sheet the user is already looking at.
 */
export function CompactShell({
  listNode,
  detailNode,
  detailLabel,
  onDetailBack,
  backLabel,
  activeDetent,
  setActiveDetent,
  onLiveInsetChange,
}: CompactShellProps) {
  const hasDetail = detailNode != null;
  const hadDetail = useRef(hasDetail);

  /**
   * Peek is 0.20vh — about 169px on a 844pt phone, which cannot show a price
   * and a back row. So a detail arriving at peek promotes the sheet to medium,
   * where the measured detail content (~316px) fits with room to spare and the
   * map stays visible above it. Never `large`: the user tapped a pin, and
   * burying the map under a 94vh sheet answers a question they did not ask.
   *
   * RISING EDGE ONLY. A plain `detent === "peek"` guard would fight a user who
   * deliberately drags the sheet back down to peek while reading detail, yanking
   * it up again every time. Promote on arrival, then leave them alone.
   *
   * page.tsx already sets medium on marker selection, so this is mostly
   * belt-and-braces. It exists so the shell is correct on its own rather than
   * because it needs to referee page.tsx.
   */
  useEffect(() => {
    const rising = hasDetail && !hadDetail.current;
    hadDetail.current = hasDetail;
    if (rising && activeDetent === "peek") setActiveDetent("medium");
  }, [hasDetail, activeDetent, setActiveDetent]);

  return (
    // No background and no map here: AdaptiveShell mounts the map once, beneath
    // this layer. Anything opaque at this level hides it outright.
    <div className="relative h-full w-full">
      <BottomSheet
        detent={activeDetent}
        onDetentChange={setActiveDetent}
        onLiveInsetChange={onLiveInsetChange}
      >
        <NavigationStack
          listNode={listNode}
          detailNode={detailNode}
          detailLabel={detailLabel}
          onDetailBack={onDetailBack}
          backLabel={backLabel}
        />
      </BottomSheet>
    </div>
  );
}
