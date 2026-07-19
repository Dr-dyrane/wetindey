import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DETENT_FRACTION,
  decaySheetVelocity,
  motion,
  nearestDetent,
  releaseSheetVelocity,
  resistedSheetFraction,
  resolveSheetCancellation,
  resolveSheetRelease,
  transition,
} from "../src/design-system/motion";
import {
  WHEEL_GESTURE_GAP_MS,
  advanceScrollExpansionGesture,
  advanceWheelDetentGesture,
  continuesWheelGesture,
  permitsScrollChaining,
  remainingDownwardTravel,
  scrollerForDirection,
  startScrollExpansionGesture,
  type WheelDetentGesture,
} from "../src/design-system/components/BottomSheet";
import {
  resolveModalFocusOwnership,
  resolveModalFocusScope,
  resolveInitialFocusTarget,
  resolveReturnFocusSource,
  resolveTabFocusBoundary,
  shouldActivateModalContainment,
  shouldMoveInitialFocus,
} from "../src/design-system/components/ModalSheet";
import {
  resetDetailScrollPosition,
  resolveDetailScrollLifecycle,
  restoreLockedScrollPosition,
  shouldContainTerminalScroll,
  shouldResetDetailScroll,
} from "../src/design-system/components/NavigationStack";

function test(name: string, run: () => void) {
  try {
    run();
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    process.stderr.write(`✗ ${name}\n`);
    throw error;
  }
}

test("nearest detent selects the closest rest position", () => {
  assert.equal(nearestDetent(0.19), "peek");
  assert.equal(nearestDetent(0.54), "medium");
  assert.equal(nearestDetent(0.91), "large");
});

test("semantic transition names resolve to the shared CSS recipes", () => {
  assert.equal(transition.press, "motion-press");
  assert.equal(transition.snapSheet, "motion-snap-sheet");
  assert.equal(transition.directManipulation, "motion-direct-manipulation");
});

test("velocity projection advances a deliberate release", () => {
  const target = resolveSheetRelease({
    startDetent: "medium",
    currentFraction: DETENT_FRACTION.medium,
    velocityFractionPerMs: 0.003,
    travelPx: 20,
  });
  assert.equal(target, "large");
});

test("a stopped finger does not retain an old fling velocity", () => {
  assert.equal(decaySheetVelocity(0.003, motion.sheet.velocityMemoryMs), 0);
  assert.ok(decaySheetVelocity(0.003, motion.sheet.velocityMemoryMs / 2) < 0.003);
  assert.equal(
    releaseSheetVelocity({ velocityFractionPerMs: 0.001, elapsedMs: 0, viewportHeight: 800 }),
    0
  );
  assert.equal(
    releaseSheetVelocity({ velocityFractionPerMs: 0.003, elapsedMs: 0, viewportHeight: 800 }),
    0.003
  );
});

test("a release never skips more than one detent", () => {
  const target = resolveSheetRelease({
    startDetent: "peek",
    currentFraction: DETENT_FRACTION.peek,
    velocityFractionPerMs: 0.02,
    travelPx: 8,
  });
  assert.equal(target, "medium");
});

test("deliberate travel falls through to one detent step", () => {
  const target = resolveSheetRelease({
    startDetent: "medium",
    currentFraction: DETENT_FRACTION.medium + 0.02,
    velocityFractionPerMs: 0,
    travelPx: motion.sheet.stepPx,
  });
  assert.equal(target, "large");
});

test("cancellation preserves an uncommitted drag", () => {
  assert.equal(
    resolveSheetCancellation({ startDetent: "medium", travelPx: motion.sheet.stepPx - 1 }),
    "medium"
  );
});

test("cancellation commits a clear one-detent direction", () => {
  assert.equal(
    resolveSheetCancellation({ startDetent: "medium", travelPx: -motion.sheet.stepPx }),
    "peek"
  );
});

test("an interrupted settle resolves from its rendered position", () => {
  const renderedFraction = 0.78;
  const target = resolveSheetRelease({
    startDetent: nearestDetent(renderedFraction),
    currentFraction: renderedFraction,
    velocityFractionPerMs: 0,
    travelPx: -motion.sheet.stepPx,
  });
  assert.equal(target, "medium");
});

test("out-of-range fractions use documented resistance", () => {
  const raw = DETENT_FRACTION.large + 0.2;
  const resisted = resistedSheetFraction(raw);
  assert.ok(resisted > DETENT_FRACTION.large);
  assert.ok(resisted < raw);
  assert.equal(
    resisted,
    DETENT_FRACTION.large + (raw - DETENT_FRACTION.large) * motion.sheet.resistance
  );
});

const modalSource = readFileSync(
  join(process.cwd(), "src/design-system/components/ModalSheet.tsx"),
  "utf8"
);
const pickerSource = readFileSync(
  join(process.cwd(), "src/design-system/components/SheetPicker.tsx"),
  "utf8"
);
const bottomSheetSource = readFileSync(
  join(process.cwd(), "src/design-system/components/BottomSheet.tsx"),
  "utf8"
);
const navigationStackSource = readFileSync(
  join(process.cwd(), "src/design-system/components/NavigationStack.tsx"),
  "utf8"
);
const pageSource = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
const globalCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

test("the modal shell has one document Escape owner", () => {
  assert.equal(
    (modalSource.match(/document\.addEventListener\("keydown", onKeyDown/g) ?? []).length,
    1
  );
  assert.match(modalSource, /trapTab\(focusScope, event\)/);
  assert.match(modalSource, /element\.inert = true/);
  assert.match(modalSource, /closest\("\[inert\], \[aria-hidden='true'\]"\)/);
  assert.match(modalSource, /document\.addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(modalSource, /document\.addEventListener\("focusin", onFocusIn, true\)/);
  assert.match(modalSource, /if \(returnFocus\?\.isConnected\) returnFocus\.focus\(\)/);
  assert.match(modalSource, /window\.history\.pushState/);
  assert.match(modalSource, /window\.addEventListener\("popstate"/);
});

test("modal focus stays bounded with zero, one, or escaped focusable controls", () => {
  assert.equal(resolveInitialFocusTarget(-1, 0), "panel");
  assert.equal(resolveInitialFocusTarget(-1, 1), 0);
  assert.equal(resolveInitialFocusTarget(1, 3), 1);

  assert.equal(
    resolveTabFocusBoundary({
      focusableCount: 0,
      activeIndex: -1,
      activeInsidePanel: true,
      shiftKey: false,
    }),
    "panel"
  );
  assert.equal(
    resolveTabFocusBoundary({
      focusableCount: 0,
      activeIndex: -1,
      activeInsidePanel: true,
      shiftKey: true,
    }),
    "panel"
  );
  assert.equal(
    resolveTabFocusBoundary({
      focusableCount: 1,
      activeIndex: 0,
      activeInsidePanel: true,
      shiftKey: false,
    }),
    0
  );
  assert.equal(
    resolveTabFocusBoundary({
      focusableCount: 1,
      activeIndex: 0,
      activeInsidePanel: true,
      shiftKey: true,
    }),
    0
  );
  assert.equal(
    resolveTabFocusBoundary({
      focusableCount: 3,
      activeIndex: -1,
      activeInsidePanel: false,
      shiftKey: true,
    }),
    2
  );
  assert.equal(
    resolveTabFocusBoundary({
      focusableCount: 3,
      activeIndex: -1,
      activeInsidePanel: true,
      shiftKey: false,
    }),
    0
  );
  assert.equal(
    resolveTabFocusBoundary({
      focusableCount: 3,
      activeIndex: 1,
      activeInsidePanel: true,
      shiftKey: false,
    }),
    2
  );
  assert.equal(
    resolveTabFocusBoundary({
      focusableCount: 3,
      activeIndex: 1,
      activeInsidePanel: true,
      shiftKey: true,
    }),
    0
  );
  assert.equal(
    resolveTabFocusBoundary({
      focusableCount: 3,
      activeIndex: 2,
      activeInsidePanel: true,
      shiftKey: false,
    }),
    0
  );
  assert.equal(
    resolveTabFocusBoundary({
      focusableCount: 3,
      activeIndex: 0,
      activeInsidePanel: true,
      shiftKey: true,
    }),
    2
  );
});

test("modal focus restoration prefers the active trigger or a recent pointer trigger", () => {
  assert.equal(
    resolveReturnFocusSource({
      hasActiveElement: true,
      activeIsPageRoot: false,
      hasRecentPointerTarget: true,
    }),
    "pointer"
  );
  assert.equal(
    resolveReturnFocusSource({
      hasActiveElement: true,
      activeIsPageRoot: true,
      hasRecentPointerTarget: true,
    }),
    "pointer"
  );
  assert.equal(
    resolveReturnFocusSource({
      hasActiveElement: true,
      activeIsPageRoot: true,
      hasRecentPointerTarget: false,
    }),
    null
  );
  assert.match(
    modalSource,
    /document\.addEventListener\("pointerdown", recordPointerTarget, true\)/
  );
  assert.match(
    modalSource,
    /document\.addEventListener\("keydown", recordKeyboardIntent, true\)/
  );
  assert.doesNotMatch(modalSource, /useEffect\(\(\) => retainPointerTargetTracking/);
});

test("pushed child focus restores without a competing initial-focus move", () => {
  assert.equal(resolveModalFocusScope("parent", "child"), "child");
  assert.equal(resolveModalFocusScope("parent", null), "parent");
  assert.match(
    modalSource,
    /if \(child !== null \|\| !childReturnFocusRef\.current\) return;/
  );
  assert.equal(
    shouldMoveInitialFocus({ childOpen: false, restoringChildFocus: false }),
    true
  );
  assert.equal(
    shouldMoveInitialFocus({ childOpen: true, restoringChildFocus: false }),
    true
  );
  assert.equal(
    shouldMoveInitialFocus({ childOpen: false, restoringChildFocus: true }),
    false
  );
});

test("visible dialog order owns focus when the presentation snapshot lags", () => {
  assert.equal(
    resolveModalFocusOwnership({
      hasVisiblePanels: true,
      isLastVisiblePanel: true,
      isRegisteredTop: false,
    }),
    true
  );
  assert.equal(
    resolveModalFocusOwnership({
      hasVisiblePanels: true,
      isLastVisiblePanel: false,
      isRegisteredTop: true,
    }),
    false
  );
  assert.equal(
    resolveModalFocusOwnership({
      hasVisiblePanels: false,
      isLastVisiblePanel: false,
      isRegisteredTop: true,
    }),
    true
  );
});

test("modal containment follows mounted ownership instead of animation visibility", () => {
  assert.equal(
    shouldActivateModalContainment({ mounted: true, open: true, isFocusOwner: true }),
    true
  );
  assert.equal(
    shouldActivateModalContainment({ mounted: false, open: true, isFocusOwner: true }),
    false
  );
  assert.equal(
    shouldActivateModalContainment({ mounted: true, open: true, isFocusOwner: false }),
    false
  );
  assert.equal(
    shouldActivateModalContainment({ mounted: true, open: false, isFocusOwner: true }),
    false
  );
  assert.doesNotMatch(
    modalSource,
    /if \(!mounted \|\| !visible(?: \|\| [^)]+)?\) return;/
  );
});

test("SheetPicker pushes into an existing presentation shell", () => {
  assert.match(pickerSource, /useModalSheetNavigation/);
  assert.match(pickerSource, /navigation\.pushChild/);
  assert.match(modalSource, /ModalSheetNavigationContext/);
});

test("a newly pushed detail resets only its persistent level-one scroller", () => {
  assert.equal(shouldResetDetailScroll(false, true), true);
  assert.equal(shouldResetDetailScroll(true, true), false);
  const opening = resolveDetailScrollLifecycle(false, true);
  assert.deepEqual(opening, {
    shouldReset: true,
    committedOpen: true,
    cleanupOpen: false,
  });
  const strictReplay = resolveDetailScrollLifecycle(opening.cleanupOpen, true);
  assert.equal(strictReplay.shouldReset, true);
  const asyncUpdate = resolveDetailScrollLifecycle(opening.committedOpen, true);
  assert.equal(asyncUpdate.shouldReset, false);
  const staleDetailPosition = { scrollTop: 420, scrollLeft: 9 };
  assert.equal(resetDetailScrollPosition(staleDetailPosition), true);
  assert.deepEqual(staleDetailPosition, { scrollTop: 0, scrollLeft: 0 });
  assert.equal(resetDetailScrollPosition(staleDetailPosition), false);
  assert.equal(resetDetailScrollPosition(null), false);
  assert.match(navigationStackSource, /ref=\{detailScrollerRef\}/);
  assert.match(
    navigationStackSource,
    /useLayoutEffect\(\(\) => \{\s+const resetVisibleDetailScroll = \(\) => \{[\s\S]*?resetDetailScrollPosition\(shellScroller\);[\s\S]*?querySelector<HTMLElement>\(DETAIL_SCROLL_SELECTOR\)/
  );
  assert.equal(
    (navigationStackSource.match(/resetVisibleDetailScroll\(\);/g) ?? []).length,
    3
  );
  assert.equal(
    (navigationStackSource.match(/requestAnimationFrame\(\(\) => \{/g) ?? []).length,
    2
  );
  assert.match(navigationStackSource, /cancelAnimationFrame\(settleFrame\)/);
  assert.match(navigationStackSource, /cancelAnimationFrame\(restoreFrame\)/);
  assert.match(
    navigationStackSource,
    /wasDetailOpenRef\.current = lifecycle\.cleanupOpen;/
  );
  assert.match(navigationStackSource, /\[overflow-anchor:none\]/);
  assert.doesNotMatch(navigationStackSource, /listNode[\s\S]{0,120}scrollTo/);
});

test("async detail updates and level-zero lifetime do not reset scroll", () => {
  assert.equal(shouldResetDetailScroll(true, true), false);
  assert.equal(shouldResetDetailScroll(true, false), false);
  assert.match(navigationStackSource, /\}, \[isOpen\]\);/);
  assert.equal((navigationStackSource.match(/\{content\}/g) ?? []).length, 1);
  assert.match(navigationStackSource, /detailNode \?\? heldDetail/);
  assert.match(navigationStackSource, /window\.setTimeout\(\(\) => setHeldDetail\(null\)/);
});

test("level-one terminal input and programmatic scroll stay out of the document", () => {
  assert.equal(
    shouldContainTerminalScroll(
      { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 },
      -1
    ),
    true
  );
  assert.equal(
    shouldContainTerminalScroll(
      { scrollTop: 600, scrollHeight: 1000, clientHeight: 400 },
      1
    ),
    true
  );
  assert.equal(
    shouldContainTerminalScroll(
      { scrollTop: 300, scrollHeight: 1000, clientHeight: 400 },
      1
    ),
    false
  );
  assert.equal(
    shouldContainTerminalScroll(
      { scrollTop: 300, scrollHeight: 1000, clientHeight: 400 },
      -1
    ),
    false
  );

  const documentPosition = { scrollTop: 240, scrollLeft: 12 };
  assert.equal(restoreLockedScrollPosition(documentPosition, 0, 0), true);
  assert.deepEqual(documentPosition, { scrollTop: 0, scrollLeft: 0 });
  assert.equal(restoreLockedScrollPosition(documentPosition, 0, 0), false);
  assert.match(navigationStackSource, /onWheel=\{containTerminalWheel\}/);
  assert.match(navigationStackSource, /overscroll-y-none/);
  assert.match(
    navigationStackSource,
    /document\.addEventListener\("scroll", containDocumentScroll/
  );
  assert.match(
    navigationStackSource,
    /document\.removeEventListener\("scroll", containDocumentScroll, true\)/
  );
});

test("compact detail uses one bounded viewport instead of a terminal reservation", () => {
  assert.equal(
    pageSource.includes(
      "h-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+24px)]"
    ),
    false
  );
  assert.equal(navigationStackSource.includes("var(--sheet-hidden"), false);
  assert.match(
    navigationStackSource,
    /isBoundedDetail\s+\? "overflow-hidden md:overflow-y-auto"\s+: "overflow-y-auto"/
  );
  assert.match(
    pageSource,
    /data-navigation-detail-bounded\s+className="flex h-\[calc\(var\(--navigation-detail-visible-height,100dvh\)-var\(--safe-area-bottom\)-24px\)\] min-h-0 flex-col gap-4 md:h-full md:overflow-hidden"/
  );
  assert.match(
    navigationStackSource,
    /React\.isValidElement<BoundedDetailProps>\(node\)[\s\S]*?node\.props\["data-navigation-detail-bounded"\] === true/
  );
  assert.match(
    navigationStackSource,
    /window\.visualViewport[\s\S]*?visibleBottom - boundedDetail\.getBoundingClientRect\(\)\.top/
  );
  assert.match(
    navigationStackSource,
    /boundedDetail\.style\.setProperty\(\s+"--navigation-detail-visible-height"/
  );
  assert.match(
    navigationStackSource,
    /md:pb-\[calc\(var\(--safe-area-bottom\)\+24px\)\]/
  );
});

test("compact action is in flow above the sole Prices scroller", () => {
  assert.match(
    pageSource,
    /isRegular \? "static pt-1" : "static py-2"/
  );
  assert.doesNotMatch(pageSource, /sticky top-0 py-2/);
  assert.match(
    pageSource,
    /\{!isRegular \? getItAction : null\}[\s\S]*?data-navigation-detail-scroller[\s\S]*?\{isRegular \? getItAction : null\}/
  );
  assert.match(
    pageSource,
    /data-navigation-detail-scroller\s+className="min-h-0 flex-1 overflow-y-auto overscroll-y-none pr-1"/
  );
  assert.match(
    navigationStackSource,
    /querySelector<HTMLElement>\(DETAIL_SCROLL_SELECTOR\)/
  );
  assert.match(
    navigationStackSource,
    /event\.target\.closest<HTMLElement>\(DETAIL_SCROLL_SELECTOR\)/
  );
  assert.match(
    navigationStackSource,
    /if \(nestedScroller\) event\.stopPropagation\(\);/
  );
  assert.match(
    navigationStackSource,
    /onPointerDown=\{containNestedDetailGesture\}[\s\S]*?onTouchCancel=\{containNestedDetailGesture\}/
  );
  assert.match(
    navigationStackSource,
    /event\.target\.closest\(DETAIL_SCROLL_SELECTOR\)[\s\S]*?event\.stopPropagation\(\)/
  );
});

test("compact persistent and regular static market actions retain one rendered branch", () => {
  assert.equal((pageSource.match(/\{!isRegular \? getItAction : null\}/g) ?? []).length, 1);
  assert.equal((pageSource.match(/\{isRegular \? getItAction : null\}/g) ?? []).length, 1);
  assert.equal((pageSource.match(/const getItAction = \(/g) ?? []).length, 1);
});

test("the drag path schedules DOM work instead of setting per-frame React state", () => {
  assert.match(bottomSheetSource, /requestAnimationFrame\(renderLiveFraction\)/);
  assert.doesNotMatch(bottomSheetSource, /setDragFraction/);
  assert.match(bottomSheetSource, /settleFrameRef/);
  assert.match(bottomSheetSource, /style\.transition = "none"/);
  assert.match(bottomSheetSource, /applyFraction\(drag\.currentFraction\)/);
  assert.match(bottomSheetSource, /releaseSheetVelocity\(\{/);
});

test("scroll handoff and keyboard viewport handling remain in the sheet contract", () => {
  assert.match(bottomSheetSource, /motion\.sheet\.stepPx/);
  assert.match(bottomSheetSource, /window\.visualViewport\?\.addEventListener\("resize"/);
});

test("top-edge wheel handoff can collapse one detent without stealing editable controls", () => {
  assert.match(bottomSheetSource, /\[contenteditable\]:not\(\[contenteditable='false'\]\)/);
  assert.match(
    bottomSheetSource,
    /target\.closest\(EDITABLE_SELECTOR\)[\s\S]*dragRef\.current = null/
  );
  assert.match(bottomSheetSource, /gesture\.spent/);
  assert.match(bottomSheetSource, /continuesWheelGesture\(previous\.lastTime, eventTime\)/);
  assert.match(bottomSheetSource, /const canCollapse =/);
  assert.match(bottomSheetSource, /stepDetent\(advanced\.step\)/);
  assert.match(
    bottomSheetSource,
    /pointerGesture\?\.pointerEnded[\s\S]*dragRef\.current = null/
  );
  assert.match(bottomSheetSource, /const inputDirection: ScrollDirection \| null/);
  assert.match(
    bottomSheetSource,
    /addEventListener\("wheel", onWheel, \{ capture: true, passive: false \}\)/
  );
});

test("wheel momentum spends one detent but a later gesture starts cleanly", () => {
  assert.equal(continuesWheelGesture(1000, 1000 + WHEEL_GESTURE_GAP_MS), true);
  assert.equal(continuesWheelGesture(1000, 1001 + WHEEL_GESTURE_GAP_MS), false);
  assert.equal(continuesWheelGesture(1000, 999), false);

  let gesture: WheelDetentGesture | null = null;
  let advanced = advanceWheelDetentGesture(gesture, 1000, -1, motion.sheet.stepPx / 2);
  gesture = advanced.gesture;
  assert.equal(advanced.step, null);

  advanced = advanceWheelDetentGesture(gesture, 1010, -1, motion.sheet.stepPx / 2);
  gesture = advanced.gesture;
  assert.equal(advanced.step, -1);

  advanced = advanceWheelDetentGesture(gesture, 1020, null, 0);
  gesture = advanced.gesture;
  assert.equal(advanced.step, null);
  advanced = advanceWheelDetentGesture(gesture, 1030, 1, motion.sheet.stepPx);
  gesture = advanced.gesture;
  assert.equal(advanced.step, null);

  advanced = advanceWheelDetentGesture(
    gesture,
    1031 + WHEEL_GESTURE_GAP_MS,
    1,
    motion.sheet.stepPx
  );
  assert.equal(advanced.step, 1);
});

test("a wheel reversal cancels unspent credit without rearming a spent gesture", () => {
  let gesture: WheelDetentGesture | null = null;
  let advanced = advanceWheelDetentGesture(gesture, 1000, -1, motion.sheet.stepPx / 2);
  gesture = advanced.gesture;
  assert.equal(gesture.distance, motion.sheet.stepPx / 2);

  advanced = advanceWheelDetentGesture(gesture, 1010, 1, 1);
  gesture = advanced.gesture;
  assert.equal(gesture.distance, 1);

  advanced = advanceWheelDetentGesture(gesture, 1020, 1, motion.sheet.stepPx / 2);
  assert.equal(advanced.step, null);

  advanced = advanceWheelDetentGesture(gesture, 1030, 1, motion.sheet.stepPx);
  gesture = advanced.gesture;
  assert.equal(advanced.step, 1);

  advanced = advanceWheelDetentGesture(gesture, 1040, -1, motion.sheet.stepPx);
  assert.equal(advanced.step, null);
});

test("a terminal wheel reversal clears credit even when that detent cannot move", () => {
  let gesture: WheelDetentGesture | null = null;
  let advanced = advanceWheelDetentGesture(gesture, 1000, -1, motion.sheet.stepPx / 2);
  gesture = advanced.gesture;

  advanced = advanceWheelDetentGesture(gesture, 1010, 1, 0);
  gesture = advanced.gesture;
  assert.equal(gesture.direction, 1);
  assert.equal(gesture.distance, 0);

  advanced = advanceWheelDetentGesture(gesture, 1020, -1, motion.sheet.stepPx / 2);
  assert.equal(advanced.step, null);
});

test("one touch scroll gesture spends once across nested scrollers and reversal", () => {
  let gesture = startScrollExpansionGesture();
  let advanced = advanceScrollExpansionGesture(gesture, motion.sheet.stepPx);
  gesture = advanced.gesture;
  assert.equal(advanced.shouldStep, true);

  advanced = advanceScrollExpansionGesture(gesture, motion.sheet.stepPx);
  assert.equal(advanced.shouldStep, false);

  advanced = advanceScrollExpansionGesture(gesture, -motion.sheet.stepPx);
  assert.equal(advanced.shouldStep, false);
  advanced = advanceScrollExpansionGesture(gesture, motion.sheet.stepPx);
  assert.equal(advanced.shouldStep, false);
});

test("a later touch scroll gesture starts unblocked by prior element position", () => {
  const priorGesture = startScrollExpansionGesture();
  assert.equal(
    advanceScrollExpansionGesture(priorGesture, motion.sheet.stepPx).shouldStep,
    true
  );

  const laterGesture = startScrollExpansionGesture();
  assert.equal(
    advanceScrollExpansionGesture(laterGesture, motion.sheet.stepPx).shouldStep,
    true
  );
});

test("nested scroll ownership searches every eligible ancestor in the gesture direction", () => {
  const innerAtTop = { scrollTop: 0, scrollHeight: 600, clientHeight: 200 };
  const outerCanScrollUp = { scrollTop: 80, scrollHeight: 900, clientHeight: 400 };
  const outerAtTop = { ...outerCanScrollUp, scrollTop: 0 };
  const innerCanScrollDown = { ...innerAtTop, scrollTop: 200 };

  assert.equal(scrollerForDirection([innerAtTop, outerCanScrollUp], -1), outerCanScrollUp);
  assert.equal(scrollerForDirection([innerAtTop, outerAtTop], -1), null);
  assert.equal(
    scrollerForDirection([{ ...innerAtTop, scrollTop: 0.25 }, outerAtTop], -1)?.scrollTop,
    0.25
  );
  assert.equal(scrollerForDirection([innerCanScrollDown, outerAtTop], 1), innerCanScrollDown);
  assert.equal(permitsScrollChaining("auto"), true);
  assert.equal(permitsScrollChaining("contain"), false);
  assert.equal(permitsScrollChaining("none"), false);
});

test("a downward touch drag takes the sheet as soon as an owned list reaches its top", () => {
  assert.doesNotMatch(bottomSheetSource, /scrollSpent|scrollAnchor\.current/);
  assert.match(bottomSheetSource, /scrollExpansion: startScrollExpansionGesture\(\)/);
  assert.match(bottomSheetSource, /drag\.scrollAnchors\.get\(target\)/);
  assert.match(
    bottomSheetSource,
    /drag\.lastScrollDirection === -1 \? -Math\.abs\(scrollDelta\) : scrollDelta/
  );
  assert.match(bottomSheetSource, /advanceScrollExpansionGesture\(drag\.scrollExpansion/);
  assert.match(bottomSheetSource, /drag\.claim === "scroll"[\s\S]*travelPx < 0/);
  assert.match(bottomSheetSource, /scrollerForDirection\(drag\.scrollers, -1\) === null/);
  assert.match(bottomSheetSource, /scheduleScrolledDragEnd\(drag\)/);
  assert.match(bottomSheetSource, /drag\.pointerEnded[\s\S]*finishScrolledDrag\(drag\)/);
  assert.match(bottomSheetSource, /cancelDrag = \(event: React\.PointerEvent/);
  assert.match(bottomSheetSource, /!drag \|\| drag\.pointerId !== event\.pointerId/);
  assert.match(bottomSheetSource, /drag && drag\.pointerId !== event\.pointerId/);
  assert.match(
    bottomSheetSource,
    /drag\?\.pointerType === "touch"[\s\S]*drag\.claim === null[\s\S]*drag\.claim = "scroll"/
  );
  assert.match(bottomSheetSource, /addEventListener\("scrollend", onScrollEnd/);
  assert.match(bottomSheetSource, /updateScrollDirection\(drag, event\.clientY\)/);
  assert.match(bottomSheetSource, /drag\.pointerCancelled[\s\S]*onTouchMove/);
  assert.match(bottomSheetSource, /onTouchEnd=\{endCancelledTouch\}/);
  assert.match(bottomSheetSource, /onTouchCancel=\{cancelCancelledTouch\}/);
  assert.match(bottomSheetSource, /event\.touches\.length !== 0/);
  assert.match(
    bottomSheetSource,
    /cancelCancelledTouch[\s\S]*drag\.pointerType !== "touch"[\s\S]*dragRef\.current = null/
  );
  assert.match(bottomSheetSource, /activeTouchCountRef\.current > 1/);
  assert.match(
    bottomSheetSource,
    /const owner = scrollerForDirection\(drag\.scrollers, -1\)[\s\S]*event\.target === owner/
  );
  assert.equal(
    (bottomSheetSource.match(/addEventListener\("scrollend", onScrollEnd/g) ?? []).length,
    1
  );
  assert.match(
    bottomSheetSource,
    /drag\.pointerType !== "touch"[\s\S]*dragRef\.current = null/
  );
  assert.doesNotMatch(bottomSheetSource, /scrollEndTimerRef|setTimeout\(/);
  assert.match(
    bottomSheetSource,
    /handoffToSheet\(drag, drag\.lastY, drag\.lastTime, carriedTravelPx\)/
  );
  assert.equal(remainingDownwardTravel(100, 180, 50), -30);
  assert.equal(remainingDownwardTravel(100, 140, 50), 0);
  assert.equal(remainingDownwardTravel(100, 220, 50), -70);
  assert.equal(remainingDownwardTravel(150, 230, 100), 0);
});

test("detent settlement keeps sheet layout geometry stable", () => {
  assert.match(bottomSheetSource, /const sideInset = ISLAND_INSET/);
  assert.match(bottomSheetSource, /const bottomInset = ISLAND_INSET/);
  assert.doesNotMatch(bottomSheetSource, /DOCK_START|DOCK_END/);
});

test("reduced-motion alternatives preserve layout transforms while collapsing duration", () => {
  assert.match(globalCss, /--motion-press-scale: 1/);
  assert.doesNotMatch(globalCss, /\.motion-snap-sheet\s*\{\s*transform: none !important/);
  assert.match(globalCss, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(globalCss, /--motion-blur-backdrop: var\(--motion-blur-reduced\)/);
});
