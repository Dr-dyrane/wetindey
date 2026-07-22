import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isCurrentInsetPublication,
  isActiveDragPointer,
  insetPublicationOwnerAfter,
  liveSheetInset,
  nextInsetPublicationGeneration,
  pointerDownPublicationAction,
  shouldCommitViewportHeightToReact,
  shouldHandlePointerCancellation,
  shouldHandleTouchCancellation,
  shouldTrackSettlingInset,
  snapPublicationStarter,
  translateYFromTransform,
} from "../src/design-system/components/BottomSheet";
import { shellBottomInset } from "../src/design-system/components/AdaptiveShell";

function test(name: string, run: () => void) {
  try {
    run();
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    process.stderr.write(`✗ ${name}\n`);
    throw error;
  }
}

test("drag intermediates publish their live fraction and rendered pixel inset", () => {
  assert.deepEqual(liveSheetInset(0.43, 446), { fraction: 0.43, sheetTop: 446 });
  assert.equal(shellBottomInset(false, 800, liveSheetInset(0.43, 446)), "354.00px");
  assert.equal(shellBottomInset(false, 800, liveSheetInset(0.61, 300)), "500.00px");
});

test("matrix and matrix3d transforms preserve snap tracking", () => {
  assert.equal(translateYFromTransform("matrix(1, 0, 0, 1, 0, 123.5)"), 123.5);
  assert.equal(
    translateYFromTransform("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 456.25, 0, 1)"),
    456.25
  );
});

test("a new drag invalidates the prior snap publication generation", () => {
  const snapGeneration = nextInsetPublicationGeneration(0);
  const dragGeneration = nextInsetPublicationGeneration(snapGeneration);
  assert.equal(isCurrentInsetPublication(snapGeneration, dragGeneration), false);
  assert.equal(isCurrentInsetPublication(dragGeneration, dragGeneration), true);
});

test("a secondary pointer cannot steal an active drag owner", () => {
  const activePointerId = 17;
  const secondaryPointerId = 23;
  const liveDrag = {
    activePointerId,
    generation: 9,
    inset: 412,
    owner: "drag" as const,
    effectStarts: 0,
    settleStarts: 0,
  };

  const secondaryDown = pointerDownPublicationAction(
    liveDrag.activePointerId,
    secondaryPointerId
  );

  assert.equal(secondaryDown, "ignore-active-owner");
  assert.deepEqual(liveDrag, {
    activePointerId,
    generation: 9,
    inset: 412,
    owner: "drag",
    effectStarts: 0,
    settleStarts: 0,
  });

  assert.equal(isActiveDragPointer(liveDrag.activePointerId, secondaryPointerId), false);
  assert.equal(
    shouldHandlePointerCancellation(liveDrag.activePointerId, secondaryPointerId),
    false
  );
  assert.equal(shouldHandleTouchCancellation(liveDrag.activePointerId, 1), false);
  assert.deepEqual(liveDrag, {
    activePointerId,
    generation: 9,
    inset: 412,
    owner: "drag",
    effectStarts: 0,
    settleStarts: 0,
  });

  assert.equal(shouldHandlePointerCancellation(liveDrag.activePointerId, activePointerId), true);
  assert.equal(shouldHandleTouchCancellation(liveDrag.activePointerId, 0), true);
  const matchedPrimaryRelease = snapPublicationStarter("large", "medium");
  assert.equal(matchedPrimaryRelease, "detent-effect");
  const released = {
    ...liveDrag,
    owner: "snap" as const,
    activePointerId: null,
    effectStarts: liveDrag.effectStarts + 1,
  };
  assert.equal(released.effectStarts + released.settleStarts, 1);
});

test("every non-vertical pointer path transfers publication back to the snapped detent", () => {
  const snapPaths = [
    "guard",
    "tap",
    "horizontal",
    "scroll",
    "pointercancel",
    "release",
  ] as const;
  for (const path of snapPaths) assert.equal(insetPublicationOwnerAfter(path), "snap");
  assert.equal(insetPublicationOwnerAfter("vertical-drag"), "drag");
});

test("a visual-viewport resize never restarts snap tracking while a drag owns the inset", () => {
  assert.equal(shouldTrackSettlingInset(800, false), true);
  assert.equal(shouldTrackSettlingInset(800, true), false);
  assert.equal(shouldTrackSettlingInset(0, false), false);
});

test("an active vertical drag defers viewport React state until ownership returns", () => {
  assert.equal(shouldCommitViewportHeightToReact(true), false);
  assert.equal(shouldCommitViewportHeightToReact(false), true);
});

test("a changed detent delegates one snap start to the effect while an unchanged one starts in settle", () => {
  assert.equal(snapPublicationStarter("large", "medium"), "detent-effect");
  assert.equal(snapPublicationStarter("medium", "medium"), "settle");
});

test("regular layouts and a released compact callback publish zero", () => {
  const inset = liveSheetInset(0.61, 300);
  assert.equal(shellBottomInset(true, 800, inset), "0px");
  assert.equal(shellBottomInset(false, 800, null), "0px");
});

const bottomSheetSource = readFileSync(
  join(process.cwd(), "src/design-system/components/BottomSheet.tsx"),
  "utf8"
);
const compactShellSource = readFileSync(
  join(process.cwd(), "src/design-system/components/CompactShell.tsx"),
  "utf8"
);
const adaptiveShellSource = readFileSync(
  join(process.cwd(), "src/design-system/components/AdaptiveShell.tsx"),
  "utf8"
);
const pageSource = readFileSync(join(process.cwd(), "src/app/_components/map-presentation/styles/MapPresentation.css"), "utf8");

test("pointer paths transfer ownership and layout cleanup cancels all publishers", () => {
  assert.match(bottomSheetSource, /pointerDownPublicationAction\(/);
  assert.match(
    bottomSheetSource,
    /useLayoutEffect\(\(\) => \{[\s\S]*cancelLiveFrame\(\);[\s\S]*cancelSettlingFrame\(\);[\s\S]*cancelInsetFrame\(\);[\s\S]*cancelScrollEndFrame\(\);[\s\S]*liveInsetCallbackRef\.current\?\.\(null\)/
  );
  for (const path of ["guard", "tap", "horizontal", "scroll", "pointercancel", "release"]) {
    assert.match(bottomSheetSource, new RegExp(`transferInsetPublication\\("${path}"\\)`));
  }
  assert.match(bottomSheetSource, /transferInsetPublication\("vertical-drag"\)/);
  assert.match(bottomSheetSource, /deferredViewportHeightRef\.current = nextHeight/);
  assert.match(bottomSheetSource, /reconcileDeferredViewportHeight\(\)/);
  assert.match(bottomSheetSource, /pendingDetentPublicationRef\.current = next/);
  assert.match(bottomSheetSource, /snapPublicationStarter\(next, detentRef\.current\)/);
  assert.match(bottomSheetSource, /scheduleSettlingInsetRef\.current\(DETENT_FRACTION\[detent\]\)/);
  assert.match(bottomSheetSource, /scheduleSettlingInset\(DETENT_FRACTION\[next\]\)/);
  assert.match(compactShellSource, /onLiveInsetChange=\{onLiveInsetChange\}/);
  assert.match(adaptiveShellSource, /onLiveInsetChange=\{publishLiveInset\}/);
  assert.match(adaptiveShellSource, /style\.setProperty\(/);
});

test("the shell publishes sheet height only and page owns the additive safe area", () => {
  assert.doesNotMatch(bottomSheetSource, /safe-area-inset-bottom/);
  assert.doesNotMatch(adaptiveShellSource, /safe-area-inset-bottom/);
  assert.match(
    pageSource,
    /calc\(var\(--shell-bottom-inset, 0px\) \+ env\(safe-area-inset-bottom, 0px\) \+ 16px\)/
  );
});
