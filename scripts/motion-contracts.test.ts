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
  assert.match(bottomSheetSource, /applyFraction\(frozenFraction\)/);
  assert.match(bottomSheetSource, /releaseSheetVelocity\(\{/);
});

test("scroll handoff and keyboard viewport handling remain in the sheet contract", () => {
  assert.match(bottomSheetSource, /motion\.sheet\.stepPx/);
  assert.match(bottomSheetSource, /window\.visualViewport\?\.addEventListener\("resize"/);
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
