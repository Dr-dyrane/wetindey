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
| `src/app/actions.ts` | ~1358 | *unclaimed* |
| `src/app/page.tsx` | ~1300 | **auth** | session *WetinDey UI/UX + auth* | 🟢 **active — scope resolved** | `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/**`, `src/app/_components/ProfileSheet.tsx`, `src/app/page.tsx`, `package.json`, `src/core/i18n/strings.ts` | route 1 | 2026-07-16 | **OWNER DECIDED 2026-07-16: KEEP AUTH.** Route 1 of the *Open conflict* below. Committed at 26350ba, signed in live. **governance: this needs a superseding ADR** — it must supersede Bible 40.1 *Anonymous browse* and amend ADR-002's refusal list ("no accounts/auth/RBAC"). I have not written it: `docs/adr/**` is your lane. Also: SERVICE-ARCHITECTURE.md:62 "Zero route handlers" is false and the code wins — yours to correct. |
| `package.json` / `package-lock.json` | — | **auth** | session *WetinDey UI/UX + auth* | 🟢 **active — scope resolved** | `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/**`, `src/app/_components/ProfileSheet.tsx`, `src/app/page.tsx`, `package.json`, `src/core/i18n/strings.ts` | route 1 | 2026-07-16 | **OWNER DECIDED 2026-07-16: KEEP AUTH.** Route 1 of the *Open conflict* below. Committed at 26350ba, signed in live. **governance: this needs a superseding ADR** — it must supersede Bible 40.1 *Anonymous browse* and amend ADR-002's refusal list ("no accounts/auth/RBAC"). I have not written it: `docs/adr/**` is your lane. Also: SERVICE-ARCHITECTURE.md:62 "Zero route handlers" is false and the code wins — yours to correct. |
| `AGENTS.md`, `DECISIONS.md`, `WETINDEY_BIBLE.md`, `docs/adr/**` | — | **governance** |

---

## Lanes

| Lane | Owner | Status | Owns these paths | Roadmap | Claimed | Notes |
|---|---|---|---|---|---|---|
| **auth** | session *WetinDey UI/UX + auth* | 🟢 **active — scope resolved** | `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/**`, `src/app/_components/ProfileSheet.tsx`, `src/app/page.tsx`, `package.json`, `src/core/i18n/strings.ts` | route 1 | 2026-07-16 | **OWNER DECIDED 2026-07-16: KEEP AUTH.** Route 1 of the *Open conflict* below. Committed at 26350ba, signed in live. **governance: this needs a superseding ADR** — it must supersede Bible 40.1 *Anonymous browse* and amend ADR-002's refusal list ("no accounts/auth/RBAC"). I have not written it: `docs/adr/**` is your lane. Also: SERVICE-ARCHITECTURE.md:62 "Zero route handlers" is false and the code wins — yours to correct. | session *WetinDey UI/UX + auth* (identified) | 🔴 **active — needs a decision** | `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/**`, `src/app/_components/ProfileSheet.tsx`, `src/app/page.tsx`, `package.json`, `src/core/i18n/strings.ts` | **none — out of scope** | 2026-07-16 | **Blocked on scope, not on code — agreed.** Owner asked for it directly in chat ("commcne neon auth", "create an auth account using halodyrane@gmail.com", "ill provide otp"), which is why it exists; that instruction and ADR-002's refusal list are both the owner's and they contradict. Escalated to the owner — route 1 (a superseding ADR) or route 2 (shelve). Correction: work is **committed** (26350ba), not uncommitted, and signed in live as halodyrane@gmail.com. This lane will not widen or proceed pending the decision. |
| **logo / brand** | session *Logo SVG refinement* | 🟡 active | `src/design-system/brand/**`, `NigeriaLogo.tsx` | — | 2026-07-16 | Briefed on ADR-001/002. Design canons unchanged. |
| **governance** | this session | 🟢 active | `AGENTS.md`, `DECISIONS.md`, `WETINDEY_BIBLE.md`, `docs/adr/**`, `docs/architecture/**`, `LANES.md` | Phase 6 | 2026-07-16 | ADR-001, ADR-002 landed. Owns doc/code drift corrections. |
| **phase-0 / orphans** | session *WetinDey UI/UX + auth* | 🟢 active | `src/modules/**`, `src/core/module-contract.ts`, `src/core/*/`, `src/integrations/*/`, `knip` config, CI, `src/design-system/components/Card.tsx` | Phase 0 | 2026-07-16 | **Unblocked:** the only stated blocker was the auth conflict (Phase 0 cuts `jotai` from `page.tsx`, which auth owns) — same session owns both, so there is no cross-lane edit. Taking it because the repo generating dead code is the cause of most of the rest, and I proved it again today: I shipped a route seam nothing called and a `.squircle-card` with one consumer. `knip` in CI is the fix I could not be trusted to be. |
| **phase-1 / trust** | *unclaimed* | ⚪ blocked | `src/lib/trust.ts`, `src/app/actions.ts`, `ItemDetailSheet.tsx`, `ItemCard.tsx` | Phase 1 | — | Blocked by Phase 0. The product's core claim. |
| **phase-2 / pilot safety** | *unclaimed* | ⚪ blocked | `vercel.json`, contact resolution, rate limiting | Phase 2 | — | Blocked by Phase 1. |
| **phase-3 / field data** | *unclaimed* | ⚪ blocked | `src/db/migrations/**`, observation write path, offline queue | Phase 3 | — | Blocked by Phase 2. |
| **phase-5 / boundaries** | *unclaimed* | 🚫 **gated** | `src/db/queries/**` | Phase 5 | — | **Gated by ADR-002 until Phases 0-4 land.** Do not start. Reorganising wrong answers produces well-structured wrong answers. |

**Status key:** 🟢 active, healthy · 🟡 active, unrelated · 🔴 active, conflicted · ⚪ unclaimed/blocked · 🚫 gated by an ADR

---

## Open conflict — the auth lane

**Unresolved as of 2026-07-16. Whoever owns the auth work must resolve this before it merges.**

An uncommitted change adds authentication: `@neondatabase/auth` (`0.4.2-beta`, with an
`overrides` pin on `next`), a route handler at `src/app/api/auth/[...path]/route.ts`, and
`src/lib/auth.ts` / `auth-client.ts`. The code itself is careful and well-reasoned. **The
problem is scope, not quality.**

It contradicts two decisions accepted the same day:

- **Bible Section 40.1: `Anonymous browse | Accepted | Reduce friction and personal-data collection`.**
- **[ADR-002](docs/adr/002-service-architecture-of-record.md)**, whose accepted roadmap lists
  *User accounts / auth / RBAC* under **What to NOT do yet** — "Phase 2 needs *device
  identity*, not users. Do not confuse 'we need auth' with 'we need accounts'."

Two honest ways out, and they are the owner's call, not an agent's:

1. **Auth is genuinely wanted** → write an ADR that supersedes the anonymous-browse
   decision and amends ADR-002's refusal list. Argue why accounts beat device identity for
   the pilot. Then this is legitimate and the lane is unblocked.
2. **Auth is premature** → shelve the branch. Phase 2 needs a signed device cookie for rate
   limiting, which is much less than an account system.

**What this conflict already proves:** the architecture of record claims "Server Actions
only — zero route handlers." That is **now false**. Per the precedence rule in
[AGENTS.md](AGENTS.md), *the code wins* — so the document is the bug and the **governance**
lane must correct it. Nobody should "fix" the code to match the doc.

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
