"use client";

import React from "react";
import { NavigationStack } from "./NavigationStack";

/**
 * PANEL GEOMETRY — continuous, not stepped.
 *
 * This replaces `lg:` (1024px), which stepped the panel 380→420 and the inset
 * 16→24 in a jump. Nothing about the layout changes character at 1024; only its
 * comfort does, and comfort is a ramp, not a switch. Those were the last 8 `lg:`
 * uses in the app, so this retires the breakpoint entirely and leaves the app
 * with exactly one width boundary.
 *
 * FLOOR 320px. At 768 the old two-island layout put 720px of chrome in a 768px
 * viewport and left the map a 16px slit — 6.25% of the screen, in a map-first
 * product. With one panel at 320, the map gets 436px (56.8%) and holds a
 * majority at every width from 768 up. 320 is not cramped: it is the iPhone SE
 * width, and the same list already renders there in the sheet.
 *
 * CAP 420px, and this is the number to argue about. It is what the content is
 * designed for today — the widest the list has ever been asked to be (the old
 * `lg:w-[420px]`). The case for 620 is real and specific to this product: the
 * Festac pilot is a few hundred metres across, so the same eight pins render at
 * 500px and at 1100px, and surplus width is worth more to a five-column
 * comparison of price/distance/freshness/confidence/source than to more empty
 * Lagos. But that row lives in page.tsx and does not exist yet, and a container
 * widened ahead of its content is not generosity — it is 200px of whitespace
 * inside rows built for 400. Raise this one constant to 620 when the
 * container-keyed row lands; nothing else here changes.
 */
const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 420;
const PANEL_WIDTH = `clamp(${PANEL_MIN_WIDTH}px, 36vw, ${PANEL_MAX_WIDTH}px)`;
const PANEL_INSET = "clamp(12px, 1.5vw, 24px)";

/**
 * What the panel hides on the leading edge. AdaptiveShell publishes this as
 * `--shell-leading-inset` so the map camera can pad by it and the location pill
 * can clear it. Nothing pads the camera today — a selected pin can land under
 * the panel, including the pin the user just tapped — but MapboxAdapter and
 * page.tsx are owned elsewhere, so this is the contract, not the fix.
 */
export const PANEL_LEADING_OCCLUSION = `calc(${PANEL_INSET} + ${PANEL_WIDTH})`;

interface RegularShellProps {
  listNode: React.ReactNode;
  detailNode?: React.ReactNode;
  detailLabel?: string;
  onDetailBack?: () => void;
  backLabel?: string;
}

/**
 * Regular width: ONE floating panel on the leading edge, map everywhere else.
 *
 * THE RIGHT ISLAND IS GONE. Two islands need roughly 1600px before the map wins
 * a bare majority of its own screen (W − 800 = 0.5W), which is outside every
 * width most of this app's users have. It was not merely tight at 768 — at 1279
 * the map still only got 37.5%. And a trailing inspector puts the answer on the
 * opposite edge from the row you tapped, with 400px of map between cause and
 * effect, on the side of the screen where nothing was touched. Detail here is a
 * drill-down that terminates the flow, not a peer you scan rows against.
 *
 * So detail pushes inside this panel, exactly as it pushes inside the sheet at
 * compact width — the same NavigationStack, the same node, the same axis. That
 * is what makes an iPad Split View drag across 768 a non-event: the detail stays
 * put and stays legible instead of teleporting from the trailing edge into a
 * sheet.
 *
 * NO `transition-all`. The old panels carried it, which was survivable only
 * while their widths were constants. Against a fluid clamp it animates `width`
 * on every resize frame — re-laying-out every card in the list, 60 times a
 * second. That is the exact failure the sheet's fixed-height surface exists to
 * avoid. Width is never transitioned; only the push's transform moves.
 */
export function RegularShell({
  listNode,
  detailNode,
  detailLabel,
  onDetailBack,
  backLabel,
}: RegularShellProps) {
  return (
    // No background and no map here: AdaptiveShell mounts the map once, beneath
    // this layer.
    <div className="relative h-full w-full">
      {/* Always chrome over the map, never the content layer — so unlike the
          sheet, which goes solid as it docks, this stays material at every
          width. Elevation and material do the separating; nothing has a stroke. */}
      <div
        className="pointer-events-auto absolute z-10 overflow-hidden material-thick squircle-xl shadow-island"
        style={{
          top: `calc(${PANEL_INSET} + var(--safe-area-top))`,
          bottom: `calc(${PANEL_INSET} + var(--safe-area-bottom))`,
          left: `calc(${PANEL_INSET} + var(--safe-area-left))`,
          width: PANEL_WIDTH,
        }}
      >
        <NavigationStack
          listNode={listNode}
          detailNode={detailNode}
          detailLabel={detailLabel}
          onDetailBack={onDetailBack}
          backLabel={backLabel}
        />
      </div>
    </div>
  );
}
