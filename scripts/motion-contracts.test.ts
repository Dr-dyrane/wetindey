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
  advanceWheelCollapseGesture,
  continuesWheelGesture,
  permitsScrollChaining,
  remainingDownwardTravel,
  scrollerForDirection,
  type WheelCollapseGesture,
} from "../src/design-system/components/BottomSheet";

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
const globalCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

test("the modal shell has one document Escape owner", () => {
  assert.equal((modalSource.match(/document\.addEventListener\("keydown"/g) ?? []).length, 1);
  assert.match(modalSource, /trapTab\(panelRef\.current, event\)/);
  assert.match(modalSource, /closest\("\[inert\], \[aria-hidden='true'\]"\)/);
  assert.match(modalSource, /lastFocusedRef\.current\?\.focus\(\)/);
  assert.match(modalSource, /window\.history\.pushState/);
  assert.match(modalSource, /window\.addEventListener\("popstate"/);
});

test("SheetPicker pushes into an existing presentation shell", () => {
  assert.match(pickerSource, /useModalSheetNavigation/);
  assert.match(pickerSource, /navigation\.pushChild/);
  assert.match(modalSource, /ModalSheetNavigationContext/);
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
  assert.match(bottomSheetSource, /gesture\.spent/);
  assert.match(bottomSheetSource, /continuesWheelGesture\(previous\.lastTime, eventTime\)/);
  assert.match(bottomSheetSource, /stepDetent\(-1\)/);
  assert.match(
    bottomSheetSource,
    /addEventListener\("wheel", onWheel, \{ capture: true, passive: false \}\)/
  );
});

test("wheel momentum spends one detent but a later gesture starts cleanly", () => {
  assert.equal(continuesWheelGesture(1000, 1000 + WHEEL_GESTURE_GAP_MS), true);
  assert.equal(continuesWheelGesture(1000, 1001 + WHEEL_GESTURE_GAP_MS), false);
  assert.equal(continuesWheelGesture(1000, 999), false);

  let gesture: WheelCollapseGesture | null = null;
  let advanced = advanceWheelCollapseGesture(gesture, 1000, motion.sheet.stepPx / 2);
  gesture = advanced.gesture;
  assert.equal(advanced.shouldStep, false);

  advanced = advanceWheelCollapseGesture(gesture, 1010, motion.sheet.stepPx / 2);
  gesture = advanced.gesture;
  assert.equal(advanced.shouldStep, true);

  advanced = advanceWheelCollapseGesture(gesture, 1020, 0);
  gesture = advanced.gesture;
  assert.equal(advanced.shouldStep, false);
  advanced = advanceWheelCollapseGesture(gesture, 1030, motion.sheet.stepPx);
  gesture = advanced.gesture;
  assert.equal(advanced.shouldStep, false);

  advanced = advanceWheelCollapseGesture(
    gesture,
    1031 + WHEEL_GESTURE_GAP_MS,
    motion.sheet.stepPx
  );
  assert.equal(advanced.shouldStep, true);
});

test("a wheel reversal cancels only unspent collapse travel", () => {
  let gesture: WheelCollapseGesture | null = null;
  let advanced = advanceWheelCollapseGesture(gesture, 1000, motion.sheet.stepPx / 2);
  gesture = advanced.gesture;
  assert.equal(gesture.distance, motion.sheet.stepPx / 2);

  advanced = advanceWheelCollapseGesture(gesture, 1010, -8);
  gesture = advanced.gesture;
  assert.equal(gesture.distance, 0);

  advanced = advanceWheelCollapseGesture(gesture, 1020, motion.sheet.stepPx / 2);
  assert.equal(advanced.shouldStep, false);
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
  assert.match(bottomSheetSource, /drag\.claim === "scroll"[\s\S]*travelPx < 0/);
  assert.match(bottomSheetSource, /scrollerForDirection\(drag\.scrollers, -1\) === null/);
  assert.match(bottomSheetSource, /scheduleScrolledDragEnd\(drag\)/);
  assert.match(bottomSheetSource, /drag\.pointerEnded[\s\S]*finishScrolledDrag\(drag\)/);
  assert.match(bottomSheetSource, /cancelDrag = \(event: React\.PointerEvent/);
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
