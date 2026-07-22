import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const globals = read("src/app/globals.css");
const motion = read("src/design-system/motion.ts");
const bottomSheet = read("src/design-system/components/BottomSheet.tsx");
const modalSheet = read("src/design-system/components/ModalSheet.tsx");

function test(name: string, run: () => void): void {
  try {
    run();
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    process.stderr.write(`✗ ${name}\n`);
    throw error;
  }
}

test("ADR-026 names only the three sheet materials and the 8px backdrop target", () => {
  assert.match(globals, /--material-context-island:\s*rgba\(255, 255, 255, 0\.62\)/);
  assert.match(globals, /--material-dense-glass:\s*rgba\(255, 255, 255, 0\.78\)/);
  assert.match(globals, /--material-expanded-glass:\s*var\(--material-dense-glass\)/);
  assert.match(globals, /--material-sheet-blur:\s*8px/);
  assert.match(globals, /--material-sheet-saturate:\s*115%/);
  assert.match(motion, /backdrop-blur-sm target/);
  assert.match(motion, /backdrop:\s*8/);
});

test("sheet materials own one static backdrop filter and never blur their contents", () => {
  const materialBlock = globals.match(
    /\.material-context-island,[\s\S]*?\.material-expanded-glass \{([\s\S]*?)\n  \}/
  )?.[1];
  assert.ok(materialBlock);
  assert.match(materialBlock, /backdrop-filter:\s*blur\(var\(--material-sheet-blur\)\)/);
  assert.match(materialBlock, /isolation:\s*isolate/);
  assert.match(materialBlock, /box-shadow:\s*inset 0 1px 0 var\(--material-edge-light\)/);
  assert.doesNotMatch(materialBlock, /(?<!backdrop-)filter:\s*blur/);
  assert.doesNotMatch(materialBlock, /transition|animation|will-change/);
});

test("light/dark and accessibility fallbacks remove blur without changing geometry", () => {
  for (const className of [
    "material-context-island",
    "material-dense-glass",
    "material-expanded-glass",
    "sheet-child-surface",
  ]) {
    assert.match(globals, new RegExp(`\\.${className}`));
    assert.match(
      globals,
      new RegExp(`@media \\(forced-colors: active\\)[\\s\\S]*?\\.${className}`)
    );
    assert.match(
      globals,
      new RegExp(`@media \\(prefers-reduced-transparency: reduce\\)[\\s\\S]*?\\.${className}`)
    );
  }
  assert.match(globals, /background:\s*Canvas;[\s\S]*?color:\s*CanvasText;/);
  assert.match(globals, /--motion-duration-slow:\s*1ms/);
  assert.match(globals, /--motion-press-scale:\s*1/);
  assert.match(globals, /\.motion-modal-panel,[\s\S]*?transform:\s*none !important/);
});

test("BottomSheet keeps detents, clip geometry, scroll handoff, and one material owner", () => {
  assert.match(
    bottomSheet,
    /data-sheet-material=\{detent === "large" \? "expanded" : "context"\}/
  );
  assert.match(bottomSheet, /material-expanded-glass/);
  assert.match(bottomSheet, /material-context-island/);
  assert.match(bottomSheet, /"--stack-surface":\s*"transparent"/);
  assert.match(bottomSheet, /data-sheet-shell/);
  assert.match(bottomSheet, /SHEET_HANDLE_TARGET_PX\b/);
  assert.match(bottomSheet, /absolute inset-0 flex cursor-grab touch-none items-center justify-center p-0/);
  assert.doesNotMatch(bottomSheet, /bg-surface-persistent/);
  assert.match(globals, /\[data-sheet-shell\] \[inert\]\[aria-hidden="true"\][\s\S]*?opacity:\s*0;/);
  assert.match(globals, /\[data-sheet-shell\] \[inert\]\[aria-hidden="true"\][\s\S]*?pointer-events:\s*none;/);
  assert.match(bottomSheet, /clipPath: interactionClip/);
  assert.match(bottomSheet, /overscroll-contain/);
  assert.match(bottomSheet, /addEventListener\("wheel", onWheel, \{ capture: true, passive: false \}\)/);
  assert.match(bottomSheet, /touchAction:\s*"pan-y pinch-zoom"/);
  assert.match(bottomSheet, /requestAnimationFrame\(renderLiveFraction\)/);
});

test("ModalSheet keeps portal, inert, focus, keyboard, and nested-child contracts", () => {
  assert.match(modalSheet, /sheet-panel material-dense-glass motion-modal-panel/);
  assert.match(modalSheet, /stack-surface sheet-child-surface/);
  assert.equal((modalSheet.match(/material-(?:context-island|dense-glass|expanded-glass)/g) ?? []).length, 1);
  assert.match(modalSheet, /createPortal\(/);
  assert.match(modalSheet, /aria-modal="true"/);
  assert.match(modalSheet, /inert=\{child \? true : undefined\}/);
  assert.match(modalSheet, /event\.key === "Escape"/);
  assert.match(modalSheet, /event\.key === "Tab"/);
  assert.match(modalSheet, /focusInitial\(resolveModalFocusScope/);
  assert.match(modalSheet, /requestAnimationFrame\(\(\) =>/);
});

process.stdout.write("liquid-glass-contract: PASS\n");
