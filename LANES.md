# Work lanes — the coordination contract

**Purpose.** Several sessions and agents work this repo at once. A lane is an exclusive
claim on a set of paths. Claim your lane before you edit; check this file before you touch
anything. One owner per path, always.

**Last updated:** 2026-07-16

---

## What this file is, and what it is not

**It is advisory.** A markdown file is not a lock. Nothing enforces it. Two sessions can
still race, and **git is the only real arbiter** — a lane claim does not prevent a merge
conflict, it just makes one less likely and easier to reason about when it happens.

**It is only as true as its last edit.** A stale claim is worse than no claim, because it
reads as authoritative. If you finish, release your lane in the same change. If you find a
claim older than **24 hours with no matching activity in `git log` or the working tree**,
treat it as expired and say so when you take it.

**It does not grant permission.** Owning a lane means nobody else is editing those files.
It does not mean your change is in scope. Scope comes from the ADRs
([DECISIONS.md](DECISIONS.md)) and the architecture of record
([docs/architecture/SERVICE-ARCHITECTURE.md](docs/architecture/SERVICE-ARCHITECTURE.md)).
**A lane is a lock, not a licence.**

---

## The rules

1. **Check first.** Read this table and run `git status` before your first edit. The
   working tree tells you what the table forgot.
2. **Claim before you edit.** Add or update your row. If your lane is not listed, add it.
3. **One owner per path.** If your work needs a path another lane owns, **do not edit it**
   — coordinate with that owner, or wait. Overlapping globs are a conflict, not a nuance.
4. **Stay inside your paths.** The strongest predictor of a bad merge here is a session
   "just fixing something while it was in there."
5. **Subagents inherit their parent's lane and may not widen it.** If you spawn agents,
   put the lane's paths in their prompt and state plainly: *edit nothing outside these
   paths; if the work needs a file outside them, stop and report back.* An agent that
   wanders outside its lane is a bug in the prompt, not in the agent.
6. **Release when done.** Set status to `done` and clear the paths, in the same change
   that finishes the work.
7. **Hot files need an explicit claim.** See below.
8. **The rule from [ADR-002](docs/adr/002-service-architecture-of-record.md) still binds:**
   *if you write it, wire it to a live call site in the same change, or do not write it.*

---

## Hot files — exclusive claim required

These are the contention points. They are large, everything touches them, and two sessions
in either one will conflict. **Never edit these without holding the lane that owns them.**

| File | Lines | Currently owned by |
|---|---:|---|
| `src/app/actions.ts` | ~1358 | **auth→trust** — claimed 2026-07-16 for the ADR-003 wiring. Contested: phase-1/trust and phase-3/field-data both need it. Coordinate before taking it. |
| `src/app/page.tsx` | ~1300 | **auth** |
| `package.json` / `package-lock.json` | — | **auth** |
| `AGENTS.md`, `DECISIONS.md`, `WETINDEY_BIBLE.md`, `docs/adr/**`, `docs/architecture/**`, `LANES.md` | — | **governance** |

---

## Lanes

| Lane | Owner | Status | Owns these paths | Roadmap | Claimed | Notes |
|---|---|---|---|---|---|---|
| **auth** | session *WetinDey UI/UX + auth* | 🟢 **active — scope resolved** | `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/**`, `src/app/_components/ProfileSheet.tsx`, `src/app/page.tsx`, `package.json`, `src/core/i18n/strings.ts` | [ADR-003](docs/adr/003-identity-for-contribution-trust.md) | 2026-07-16 | **Resolved: auth stays.** [ADR-003](docs/adr/003-identity-for-contribution-trust.md) landed — supersedes Bible 40.1, strikes accounts/auth from ADR-002's refusal list. Shipped `26350ba`. **The ADR is conditional and its condition is unmet** — see *The unbuilt half* below. Architecture doc corrected; that action is closed. |
| **logo / brand** | session *Logo SVG refinement* | 🟡 active | `src/design-system/brand/**`, `NigeriaLogo.tsx` | — | 2026-07-16 | Briefed on ADR-001/002. Design canons unchanged. |
| **governance / phase-6** | this session | ✅ done | — | Phase 6 | 2026-07-16 | **Landed.** ADR-001..006. No decision the Bible calls *accepted* now contradicts the code, and none it calls *open* is secretly shipped. Mapbox/Drizzle/Neon-Auth/freshness moved to 40.1 with ADRs; Vercel Blob demoted to *open* (zero implementation — the worst drift class). `APP-MAP.md` **emptied to a tombstone** — substantially false, and a wrong map beats no map only in the wrong direction. `USER-FLOW.md` rebuilt true: delivery lines gone (ADR-001), "buttons are inert" was itself stale. Freshness row says **"Ratified, not yet true"** on purpose. No source code touched. |
| **i18n** | this session | 🟢 active | `src/core/i18n/**`, `src/design-system/components/Skeleton.tsx`, `src/design-system/components/AsyncList.tsx` | Phase 5 (partial) / knip red | 2026-07-16 | **Claimed from the unowned knip red.** ~20 unused exports in `src/core/i18n/**` — pidgin and yoruba dictionaries written and never wired, while `useStrings`/`useLocaleControl` ARE live. A language picker that does not change the sheets is a lie to a Lagos user, and the roadmap's own instruction is *adopt it or remove the picker*. Deciding from the product: this is a Lagos app; **pidgin and yoruba are the point, so adopt.** Auditing first, then wiring only sheets nobody owns. **Will not touch `page.tsx` or `actions.ts`** — auth/auth→trust own them. **knip red is 79 → 25, and ~20 of the 25 are this lane** — clearing it clears most of what is left. Open question the audit must answer: if pidgin/yoruba are `NEEDS_NATIVE_REVIEW`, shipping them is worse than English, and the honest move is to adopt the mechanism but gate the unreviewed locales. |
| **phase-0 / orphans** | session *WetinDey UI/UX + auth* | ✅ done | — | Phase 0 | 2026-07-16 | **Landed add5fd3.** knip 6.27 blocking in CI; jotai/xstate/reportingMachine/uiAtoms/FoodModule/module-contract/Card.tsx gone (24 files); @eslint/eslintrc declared. knip found a FIFTH orphan generation on its first run, unlisted by anyone. **CI IS RED (79 unused exports) AND STAYS BLOCKING — decided, not open.** A check with continue-on-error is a check configured to pass, which is the lie this repo deletes code for. The red is trust.ts (~20, phase-1 WIRES it), validation.ts + core/i18n (unowned), and 4 in actions.ts (auth→trust, in flight). It clears by cleaning the repo. Do not buy green with ignores. |
| **map/sheet-choreography** | session *WetinDey UI/UX + auth* | 🟢 active | `src/integrations/maps/MapboxAdapter.ts`, `src/design-system/components/MapboxCanvas.tsx`, `src/design-system/components/ModalSheet.tsx`, `src/app/page.tsx` | — | 2026-07-16 | Route follows roads (Mapbox Directions — a directions source is NOT a delivery API; ADR-001 blocks couriers/dispatch/checkout, not wayfinding). Presenting a modal over the sheet demotes the sheet so the map stays visible, and the modal drops its scrim. `page.tsx` already this session's via the auth lane. |
| **auth→trust** | session *WetinDey UI/UX + auth* | 🟢 active | `src/app/actions.ts`, `src/lib/trust.ts`, `src/db/schema/index.ts`, `src/db/migrations/**` | ADR-003 condition | 2026-07-16 | **Making ADR-003's condition true.** Nullable `sources.user_id`; the write paths resolve a session to a per-user source instead of the one shared "Contributor" row; anonymous fallback preserved; `assessTrust` weights a `reliability_score_internal` that finally varies. Taken because governance is right that auth today is a capability with no live call site in the domain — my own rule, and I broke it one level up. **Overlaps phase-1/trust by design** (both want actions.ts + trust.ts): this IS the front half of Phase 1, so whoever takes phase-1 should talk to me rather than fork it. |
| **phase-1 / trust** | *unclaimed* | ⚪ blocked | `src/lib/trust.ts`, `src/app/actions.ts`, `ItemDetailSheet.tsx`, `ItemCard.tsx` | Phase 1 | — | Blocked by Phase 0. The product's core claim. |
| **phase-2 / pilot safety** | *unclaimed* | ⚪ blocked | `vercel.json`, contact resolution, rate limiting | Phase 2 | — | Blocked by Phase 1. |
| **phase-3 / field data** | *unclaimed* | ⚪ blocked | `src/db/migrations/**`, observation write path, offline queue | Phase 3 | — | Blocked by Phase 2. |
| **phase-5 / boundaries** | *unclaimed* | 🚫 **gated** | `src/db/queries/**` | Phase 5 | — | **Gated by ADR-002 until Phases 0-4 land.** Do not start. Reorganising wrong answers produces well-structured wrong answers. |

**Status key:** 🟢 active, healthy · 🟡 active, unrelated · 🔴 active, conflicted · ⚪ unclaimed/blocked · 🚫 gated by an ADR

---

## Resolved 2026-07-16 — the auth lane

**Auth stays.** The owner's reasoning: it is how the app knows who says what, and how
contribution trust can rise above a constant. That is not scope creep — it is the
precondition the architecture of record identified for the trust model, which has no author
for any row. [ADR-003](docs/adr/003-identity-for-contribution-trust.md) records it:
**reading is anonymous forever; writing may be attributed. Recognition, never a gate.**

Bible 40.1 is superseded; ADR-002's refusal list no longer refuses accounts (RBAC still
refused). The architecture doc's "zero route handlers" claim is corrected. **Both handoffs
from the auth lane are closed.**

*The precedence rule earned its keep on day one: the doc went stale within hours, the code
won, and the document was fixed — not the code.*

---

## The unbuilt half — the live risk, and it outranks Phase 0

**[ADR-003](docs/adr/003-identity-for-contribution-trust.md) is accepted but its condition
is NOT met.** Auth ships and delivers none of the benefit it was accepted for:

- `sources` has **no `user_id`**. Every contribution still resolves to the one shared
  `"Contributor"` row (`src/app/actions.ts:313-322`).
- `src/app/actions.ts` has **no session awareness**. Its comments still read *"there is no
  auth in this app"* — accurate, for the write path.
- `reliability_score_internal` is still the constant `70` for everyone.

**Today the app collects an email address and gets nothing for it.** That is worse than
having no auth: PII taken, benefit unbuilt, NDPR obligations incurred. It is also the exact
failure mode this repo keeps repeating — a correct capability with no live call site — only
this time it is the *domain* that is unwired, not a leaf file.

**Whoever takes the wiring owns `src/app/actions.ts` and a migration**, so it will contest
the phase-1/trust lane. Claim before starting. The shape is in ADR-003: nullable
`sources.user_id`, session-resolved source per writer, anonymous fallback preserved,
`assessTrust` weighting a score that finally varies.

---

## Claiming a lane

Add a row. Be specific about paths — a lane like `src/**` is not a claim, it is a blockade.

```md
| **my-lane** | session name or your name | 🟢 active | `src/lib/foo.ts`, `src/app/_components/Bar.tsx` | Phase N | 2026-07-16 | one line on what and why |
```

Then, in every subagent prompt you spawn:

> Your lane is **my-lane**. You may edit ONLY: `src/lib/foo.ts`, `src/app/_components/Bar.tsx`.
> Do not edit any other file. If the work requires a file outside this list, stop and report
> back rather than widening your scope. Read `LANES.md` and `DECISIONS.md` first.
