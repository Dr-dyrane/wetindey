/**
 * Design-system control accessibility contract.
 *
 * Three regressions this repo shipped once and must not ship again:
 *
 * 1. SheetPicker's trigger named itself by the label ALONE, so assistive tech
 *    heard "Market, button" and never the selected value. The accessible name
 *    must compose the label with the value span (aria-labelledby replaces
 *    content; it does not add to it).
 *
 * 2. Input rendered its `error` as a bare paragraph: no id, no aria-invalid,
 *    no aria-describedby, no announcement. Colour alone is not an error
 *    signal, and this component carries the price field, the app's only
 *    write path.
 *
 * 3. SearchField's clear button had no type, so inside any future form it
 *    would submit instead of clearing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const picker = readFileSync(join(ROOT, "src/design-system/components/SheetPicker.tsx"), "utf8");
const input = readFileSync(join(ROOT, "src/design-system/components/Input.tsx"), "utf8");
const search = readFileSync(join(ROOT, "src/design-system/components/SearchField.tsx"), "utf8");

// 1a. The trigger's name composes label + value; value-only when unlabeled
// (every live call site passes a label; the placeholder carries the prompt).
assert.match(
  picker,
  /aria-labelledby=\{label \? `\$\{labelId\} \$\{valueId\}` : valueId\}/,
  "SheetPicker trigger must announce the selected value in its accessible name",
);
// 1b. The value span actually carries the referenced id.
assert.match(picker, /<span\s+id=\{valueId\}/);
// 1c. No content-replacing aria-label remains on the trigger, and the label
// element is wired to the trigger it labels.
assert.doesNotMatch(picker, /aria-label=\{label \? undefined : title\}/);
assert.match(picker, /htmlFor=\{triggerId\}/);
assert.match(picker, /id=\{triggerId\}/);

// 2a. The input declares its invalid state and points at the error text.
assert.match(input, /aria-invalid=\{error \? true : props\["aria-invalid"\]\}/);
// 2d. The a11y attributes sit AFTER the spread, or a consumer's raw values
// would silently clobber the merged wiring.
assert.ok(
  input.indexOf("{...props}") < input.indexOf("aria-describedby={describedBy}"),
  "aria wiring must come after the props spread",
);
assert.match(input, /aria-describedby=\{describedBy\}/);
// 2b. Consumer-passed descriptions merge rather than vanish.
assert.match(input, /props\["aria-describedby"\]/);
// 2c. The error is announced when it appears and carries the referenced id.
assert.match(input, /<p id=\{errorId\} role="alert"/);

// 3. The clear control can never submit a form.
const clearButton = search.match(/<button[\s\S]*?aria-label=\{clearLabel\}/)?.[0];
assert.ok(clearButton, "SearchField clear button missing");
assert.match(clearButton, /type="button"/);

console.log("design-system a11y contract: all assertions passed");
