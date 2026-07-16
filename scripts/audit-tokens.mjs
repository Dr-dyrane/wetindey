#!/usr/bin/env node
/**
 * Guards two invariants that are easy to break and hard to see:
 *
 *   1. No hardcoded colours. Every colour must flow through a semantic token.
 *      This is not tidiness — `bg-accent text-white` renders white-on-white in
 *      dark mode, because accent INVERTS between themes. That shipped once.
 *   2. No borders. Separation comes from material, elevation and fill.
 *
 * Run: npm run audit:tokens
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PALETTE = "white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOUR = new RegExp(`\\b(?:selection:)?(?:bg|text|fill|stroke|border|ring|from|to|via)-(?:${PALETTE})(?:-\\d{2,3})?(?:\\/\\d+)?\\b`, "g");
const BORDER = /\bborder(?:-[trblxy])?-(?:\d|\[)|\bring-\d|\bring-inset\b|\bhairline-[tb]\b/g;

// Legitimate, documented exceptions — each must carry a comment saying why.
const ALLOW = [
  "src/app/layout.tsx",                        // <meta theme-color>: read before CSS, cannot be a var()
  "src/design-system/brand/logoGeometry.ts",   // brand asset geometry
];

const walk = (d, out = []) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(p)) out.push(p);
  }
  return out;
};

let fail = 0;
for (const file of walk("src")) {
  if (ALLOW.some((a) => file.endsWith(a.replace("src/", "")) && file.includes(a))) continue;
  const src = readFileSync(file, "utf8");
  for (const [re, label] of [[COLOUR, "hardcoded colour"], [BORDER, "border/ring"]]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const line = src.slice(0, m.index).split("\n").length;
      console.error(`  ${label}: ${file}:${line}  ->  ${m[0]}`);
      fail++;
    }
  }
}

if (fail) {
  console.error(`\n${fail} violation(s). Colours must use semantic tokens; nothing may carry a stroke.`);
  process.exit(1);
}
console.log("audit:tokens — clean. No hardcoded colours, no borders.");
