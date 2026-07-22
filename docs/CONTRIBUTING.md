# Contributing to WetinDey

This document is mostly **why**, not **what**. The rules are short and you could
infer them from the code; the reasons are not obvious and every one of them was
learned expensively. If you know only the rules you will follow them where they
are written down and break them everywhere else.

Get set up first: [`../README.md`](../README.md).

---

## Before you write anything: read the map

**[`SERVICE-ARCHITECTURE.md`](./architecture/SERVICE-ARCHITECTURE.md) is the architecture of record for what is currently implemented.** Eight subsystem
surveys, six flow traces, 143 claims — 112 survived adversarial refutation and
31 were killed. Every surviving claim carries a `file:line`.

Read it because **this codebase does not mean what it looks like it means**. It
contains two versions of itself: a thoughtful one that is dead, and a crude one
that runs.

- `FoodModule.ts` holds the only real trust model — age-decayed confidence, a
  `{staleHours: 24, expirationHours: 72}` policy. It has **zero importers**.
  `actions.ts:135` fakes the same idea with `supportingObservationCount * 10`.
- `reportingMachine.ts` is a complete xstate machine. It has **zero importers**.
  `page.tsx` hand-rolls the same states in six booleans.

So: **prefer wiring what exists over writing a third copy.** When you need a
behaviour, grep for it before you build it — the odds are genuinely good that
the considered version is already here and simply unimported. `SERVICE-ARCHITECTURE.md` records the current implementation boundaries, discrepancy findings, and cited confirmed defects; verify the live tree before relying on any historical inventory.

The corollary is that a claim without evidence is worthless here. Cite
`file:line` in PR descriptions and in review. "I think X handles that" has been
wrong too often.

---

## The rule that matters most: no silent fallbacks

**Never make a function return a plausible wrong answer when it could throw.**

This is first because it cost the most. `geographyPoint.fromDriver` used to
return `{lng: 0, lat: 0}` when it could not decode a point. `{0, 0}` is in the
Gulf of Guinea, several hundred kilometres off Lagos. So every place in the app
sat in the ocean, the map looked empty, and every distance computed as 0 m.

That bug survived **for the life of the project**. It led every one of the eight
subsystem surveys. Not because it was subtle in effect — the app was visibly
broken — but because the *cause* was invisible: nothing errored, nothing logged,
no test failed. It just quietly answered the wrong question. It read as "the map
is broken", which is a symptom you can stare at for months.

It now **throws** (`src/db/schema/index.ts:70-72`). Do not add a fallback back.
Do not add one anywhere else either.

> A plausible wrong answer hides for months. An exception surfaces on day one.

The tell for this anti-pattern is `|| defaultValue` on something that is not
genuinely optional, or a `catch` that returns a value instead of rethrowing.
`|| ""` on a required token and `?? 0` on a coordinate are the same bug wearing
different clothes. If the input is broken, say so, loudly, at the point of
breakage.

Two live instances of this pattern remain and are worth knowing about, since
they'll bite you personally rather than users: the Mapbox token falls back to
`""` (`MapboxAdapter.ts:135`), so a missing token silently yields a blank map;
and `drizzle.config.ts:8` falls back to `""` for `DATABASE_URL`. Both are
documented in the README.

---

## Design rules

`npm run audit:tokens` **fails the build** on the first two. It walks every
`.ts`/`.tsx`/`.css` file under `src/` and exits non-zero on a match
(`scripts/audit-tokens.mjs`). Run it before every commit; `npx tsc --noEmit` too.
Both must pass.

### 1. Zero borders, rings, hairlines

Enforced globally in `globals.css` (`* { border-style: none; }`) and by the
audit's `BORDER` regex.

**Why:** this follows the HIG rather than defying it. Apple's Materials guidance
specifies that separation comes from **the material and vibrancy themselves** —
there is no instruction anywhere to stroke a material. The ubiquitous
`border: 1px solid rgba(255,255,255,0.25)` on glass is a **web convention** that
web developers assume is the Apple look. It isn't. (Liquid Glass's specular
highlight reads as a bright edge, but that's a rendered lighting effect, not a
stroke.)

Separation comes from exactly three things:

1. **Material** — `.material-thin` / `-regular` / `-thick`
2. **Elevation** — `--shadow-card` / `-raised` / `-sheet` / `-island`
3. **Fill** — `--color-fill-primary` … `-quaternary`

If two things aren't separating, you have reached for the wrong one of those
three. You have not discovered the one case that needs a border.

### 2. Zero hardcoded colours — semantic tokens only

No `bg-white`, `text-slate-500`, `fill-red-400`. The audit's `COLOUR` regex
catches the whole Tailwind palette across `bg|text|fill|stroke|border|ring|from|to|via`.

**Why:** **`text-white` on `bg-accent` is white-on-white in dark mode**, because
accent inverts between themes. That shipped once. It is not a hypothetical.

The trap is that hardcoding a colour is *correct in the theme you're looking at*
while you write it, so it survives review by anyone who is also looking at that
theme. Use `text-accent-contrast` and `text-onStatus` — tokens that are defined
to mean "legible on top of that", whatever "that" resolves to.

There are two documented exceptions in the `ALLOW` list, each carrying a comment
saying why: `layout.tsx` (`<meta theme-color>` is read before CSS, so it cannot
be a `var()`) and `logoGeometry.ts` (brand asset geometry). Adding a third
requires the same standard — a reason that is about the platform, not about
convenience.

### 3. Sheets, never dropdowns

`SheetPicker` presents a sheet. `DropdownMenu` was deleted — don't reintroduce it.

**Why:** the HIG says, verbatim, *"Use an action sheet — not a menu — to provide
choices related to an action"* and *"Avoid displaying popovers in compact
views."* **Every phone is a compact view, and a dropdown anchored to its trigger
is a popover.** This is a map-first app on phones. The rule follows.

Progressive reveal is **a new surface, never a swap in place** — settings and
report present *over* the results sheet, which stays mounted behind them.

See [`APPLE-HIG-MAPPING.md`](./design-system/APPLE-HIG-MAPPING.md) for the full presentation
table and the one known deviation (`SheetPicker` stacking on `ReportPriceSheet`),
which is tracked rather than hidden.

### 4. Type from the ramp, in rem

Use the named ramp — `large-title`, `title-1`…`title-3`, `headline`, `body`,
`callout`, `subhead`, `footnote`, `caption-1`, `caption-2`
(`tailwind.config.ts:76-88`). Never `text-[15px]`.

**Why:** the ramp is in `rem` so it scales with the user's font-size preference.
A `px` value ignores that, which is an accessibility regression that no one on
the team will ever notice, because no one on the team has that setting on.

### 5. Squircles

`.squircle` / `-lg` / `-xl` / `-full`, not `rounded-*`.

**Why:** a plain rounded rectangle where an Apple corner belongs is the single
loudest "this is a web page" tell in the UI. Exact parity is unreachable — the
Apple corner is three Bézier segments per corner, not a superellipse — so the
utilities encode the closest achievable approximation in one place. Use them
rather than re-deriving.

### 6. 44pt minimum touch targets

Non-negotiable and unenforced by any script, which means it's on you. The visual
element may be smaller; the *hit area* may not.

### 7. Sentence case. No uppercase headers.

"Report a price", not "REPORT A PRICE" or "Report A Price". `uppercase` is a
web/marketing convention; it degrades legibility and screen readers handle it
inconsistently.

---

## Things that look wrong and are not

Each of these cost real debugging. Please don't "fix" them.

- **`geographyPoint.fromDriver` throws.** Covered above. This is the point.
- **The theme resolves in a blocking `<head>` script before paint.** Yes, a
  blocking script. The alternative is a flash of the wrong theme on every load,
  which is worse than the microseconds it costs.
- **The sheet moves by `transform` on a fixed-height surface.** Not by animating
  height. Transforms are compositor-driven; animating height is not, and the
  drag visibly stutters.
- **Sheet heights are in `vh`, not `px`.** `px` needs `window.innerHeight`, which
  doesn't exist during SSR. That mismatch is a real hydration bug.
- **The seed writes observations first and derives every offer field from them.**
  Freshness, `expiresAt` and `supportingObservationCount` are all computed from
  the backing observations (`src/db/seed.ts:227-336`). This is the difference
  between real trust signals and fabricated ones — an earlier seed used
  `Math.random()` for freshness and a fictional support count. "No fake
  certainty" is a product non-negotiable, and it starts in the seed.

---

## Durable work memory and branch handoffs

Current edit coordination requires root [`../LANES.md`](../LANES.md): agents must consult and claim it before editing. It is the required authoritative human coordination index, advisory to Git, filesystem, runtime, and platform enforcement rather than a technical lock. Completed lane evidence is discoverable through [`operations/lanes/history/README.md`](./operations/lanes/history/README.md) but grants no current claim. For bounded work
that must survive the originating task or branch, follow the
[department worklog protocol](./operations/DEPARTMENT-WORKLOG-PROTOCOL.md) and use the
[branch handoff template](./operations/BRANCH-HANDOFF-TEMPLATE.md).

- Append only to the single functional-home log whose path is part of your exact lane.
- Never use a department log as a path lock, decision record, architecture specification,
  release verdict, or substitute for code evidence.
- Record unknown or unassigned state instead of guessing ownership, migration state,
  provider state, deployment state, or runtime behavior.
- A pre-commit review binds to full base SHA, canonical candidate-tree SHA-256, and the
  sorted exact path list; the worker/controller reports the final commit SHA afterward.
- A receiver reconciles committed ancestry, the complete diff path set, external state,
  independent verdict, conflicts, and current `LANES.md`.
- Receiver acknowledgement is a separate lane-owned append-only follow-up after receipt,
  never an edit-unlock requirement.
- If the base, candidate hash, paths, lane, verdict, external state, or conflict posture
  changes, issue a new packet. Do not patch an old packet into plausibility.

---

## Before you open a PR

```bash
npx tsc --noEmit        # must pass
npm run audit:tokens    # must pass — gates the build
npm run lint
npm run format
npx tsx --test scripts/department-worklog-contract.test.ts
```

There is no general product/runtime test suite. Focused contract scripts validate named
source or document invariants only. Neither `npm run build` nor a contract script passing
means the product works; open the app and drive the flow you changed.

### Database contributions

Read [ADR-014](./adr/014-pillar-baselines-and-release-migrations.md) and the
[database guide](./database/README.md) before claiming a schema lane. A database
change updates one canonical desired-state pillar and produces one reviewed
release delta from the exact current parent state.

The current boundary is precise:

- `0000` through `0013` are recorded applied shared-environment lineage.
- Their migration bytes and ledger evidence are immutable.
- `0014` is the current unapplied Preview-only migration gate.

Do not regenerate or rewrite applied `0000` through `0013`. Repair defects forward under
an exact schema lane. `0014` may proceed only through its separately recorded Preview
preflight and independent refutation; no Production consideration follows without a new
exact-target gate.

Generation is not rollout. Do not access Neon, run a migration or destructive
seed, or alter `drizzle.__drizzle_migrations` without separate exact-target
authorization. Every release requires a manifest, schema/RPC/RLS fingerprint,
restore evidence, and independent refutation. The seed truncates application
tables and is disposable-only.

Real code only. No TODOs, no stubs. If something can't be done properly, say so
plainly in the PR rather than leaving a placeholder that reads as finished — the
documented dead-code and implementation-gap findings in `SERVICE-ARCHITECTURE.md` are what happen when that goes unsaid.
