# Contractor Playbook

**Status:** Field guide, memory and method only
**Authority:** None. This document grants no path, decision, migration, push, or
deployment authority. Where it disagrees with [LANES.md](../../LANES.md),
[AGENTS.md](../../AGENTS.md), the
[operating system](WETINDEY-OPERATING-SYSTEM.md), or the
[worklog protocol](DEPARTMENT-WORKLOG-PROTOCOL.md), those win, in that spirit and
in every particular.

WetinDey is live. Real people in Festac Town check real prices against this
deployment, and a push to main is a production deploy. This guide exists so a
session entering the repo can start delivering expert, verified engineering
within minutes instead of hours, without stepping on the five to ten other
sessions doing the same thing. Nothing below is hypothetical: incidents marked
with a commit hash are in the repository record; the rest were witnessed live
by the session that wrote this, and some of those are told here precisely
because the record does not hold them, which is its own lesson (see section 3).

## 1. The loop

Every productive cycle this repo has recorded follows the same eight steps.

1. **Catch up.** `git log --oneline -15`, `git status --porcelain`, read root
   `LANES.md` top to bottom. The working tree tells you who is mid-flight; the
   log tells you what landed since you last looked. Never build on your memory
   of the repo: sessions land work concurrently and your model of the tree is
   stale the moment you stop reading. Witnessed live this cycle: a zero-caller
   verdict on a hook was overturned within the hour because another lane wired
   it into `useHomePage` in the meantime; only a fresh grep saved the deletion
   from breaking a live caller.
2. **Find bounded work with evidence.** The best entry points, in order: a
   worklog entry's `Exact next action` naming your functional home; a defect you
   can reproduce right now with fresh runtime evidence; a queued gate whose
   preconditions just cleared. Evidence gathering is read-only and needs no
   lane, so gather first and claim second. A seat's reopening gate that demands
   "fresh concrete runtime evidence and an exact manifest" is satisfied by a
   reproduced defect plus the file list the fix needs, nothing more.
3. **Claim in one burst.** Add the lane block under `## Active exact path
   locks` and update your roster row, then commit immediately, path-scoped to
   `LANES.md` alone. Verify the block actually landed: check the commit stat
   and grep for your heading. A text-anchor edit against a file that evolved
   under you can silently no-op and leave you believing you hold a lane you
   never recorded.
4. **Work the slice, orchestrate inside it.** Subagents inherit the lane and
   may not widen it; put the exact paths in every agent prompt with a stop-and-
   report instruction for anything outside them. Two agents must never edit the
   same file concurrently; sequence them. The worker does not commit: it leaves
   the tree for the freeze. Do not claim contract tests that other lanes' work
   also asserts against; a lane may own the test it introduces for its own
   slice (current moderation lanes do exactly that), but the repo-wide contract
   suites couple across lanes and belong to their owning seats.
5. **Freeze.** Snapshot the candidate diff to a file outside the repo and
   record what it covers. New files are not captured by `git diff` alone; note
   their hashes or accept that the refuter must verify them against source.
6. **Refute.** A fresh agent that did not produce the candidate, prompted to
   disprove specific claims and to default to REFUTED on thin evidence. Give it
   the frozen diff, the lane text, the gate commands, and a runnable harness.
   Findings come back as bounded repair work in a repair lane (which may be
   your own lane when the paths match); the refuter stays read-only unless it
   is separately given a repair lane of its own, per the operating system's
   Step 6.
7. **Commit path-scoped, tuple-bound.** `git commit -F <msg> -- <exact paths>`
   after confirming base still equals HEAD. Never bare `git add`/`git commit`:
   the shared index carries other lanes' work. Untracked new files need an
   explicit path add first; a path-scoped commit naming an untracked path
   errors atomically and commits nothing (witnessed live), so verify with
   `git log -1 --stat` that the commit you believe in actually exists and
   carries every path.
8. **Release in the same motion.** Replace the lane block with a released stub,
   idle your roster row, preserve the record in the history archive with its
   SHA-256 indexed, and commit. A stale claim is worse than no claim.

## 2. The four crossing points

The modularization holds: whole evenings run with four orchestrators committing
to main and zero source conflicts, because features live in their own MVC slice
directories. Vertical slices that end at an existing call site parallelize
freely. Exactly four places cross, and each has a discipline:

| Crossing | Why it crosses | Discipline |
|---|---|---|
| `LANES.md` | Every lane writes it by design | Edit in one short burst, commit instantly, never let edits sit. Path-scoping does not protect you within the file: committing it while another session's uncommitted bytes sit inside sweeps their work. If both of you are careful, the file is safe; if either is not, git log lies about authorship |
| Department worklogs | One append-only log per functional home | The log path must be inside a current claim to write it. If another lane holds your home's log, your entry queues; stage it in your scratchpad and watch for release |
| The wiring spine (`useHomePage`, `home-page/imports`) | Every feature lands there eventually | Build the slice complete and standalone; the spine integration is a separately claimed, serialized step. This is the repository's own Presence pattern |
| `scripts/` contract tests | They assert against source text and inject doubles into other lanes' files | Exclude the repo-wide contract suites from feature lanes; a lane may own the test it introduces for its own slice. Expect the reverse too: a test-owning lane may add a narrow guard inside your claimed file to keep its double on a legacy path. Keep it, disclose it in your worklog, never silently absorb or revert it |

## 3. Races and how they resolved

These all happened in one cycle. None required rollback, because the discipline
held.

- **A peer landed an in-flight candidate.** Witnessed live: a contractor froze
  its three-file candidate for refutation and found it already committed as
  `03adfad`, carrying a fourth docs path with another lane's worklog wording
  edits; the lane release `771d456` followed, also not by the worker.
  Resolution that held: the frozen diff was compared byte-for-byte against the
  landed commit and the refuter re-verified against the actual commit rather
  than the working tree. Resolution that failed: which session performed the
  landing was never written into the repository record, so the record cannot
  now say who landed what, and this playbook cannot either. The rule this
  burned into the contract: disclosures go into the worklog and commit message
  at landing time, by whoever lands, because git's author field is identical
  for every session and is not the truth.
- **HEAD raced the tuple.** Two lanes committed between a worklog entry's
  freeze and its commit, orphaning the recorded base SHA. Resolution: restamp
  base and digest, send the same refuter a two-line re-verification request,
  confirm base equals HEAD in the same command as the commit. A moved base is a
  new tuple; it is cheap to redo and worthless to fudge.
- **The gate was broken before the candidate existed.** A repo-wide contract
  test failed on committed main because governance archived a heading the test
  hard-required. Resolution: prove pre-existence (run the identical test
  against a pristine `git archive` of HEAD), flag it to the owning lane, record
  the disclosure in your entry, and do not let a pre-broken gate block a
  verified candidate. Never fix an out-of-lane gate from inside your lane.
- **The environment lied twice.** The embedded browser pane reports
  `visibilityState: "hidden"` between tool calls, never fires animation frames
  while hidden, and its frame probe false-negatives while the map paints
  perfectly. The owner's desktop Chrome intercepts localhost with a stale shell
  from unrelated tooling. Resolution: verification runs in a scriptable browser
  with a real compositor (the Playwright harness pattern, SwiftShader flags for
  headless WebGL, ANGLE Metal for hardware runs), and every conclusion names
  the environment it was proven in. A defect that only reproduces in a
  misleading environment is an environment finding, not a product finding.

## 4. Verification standard

There are no unit tests here and a green build proves nothing. The bar that has
held all cycle:

- **Drive the change.** A browser drove every claim that shipped: both theme
  directions, the diagnostic attributes, the overlay lifecycle, the label
  classes on the map. Screenshots and diagnostic reads go in the record.
- **Diagnostics are part of the product.** The adapter exposes its decisions as
  safe DOM attributes (`data-map-lifecycle`, `data-map-frame-evidence`,
  `data-map-theme-snapshot`). When you add machinery, add its diagnostic in the
  same change; the next refuter reads attributes instead of guessing.
- **Independent refutation is not review.** The refuter is prompted to destroy
  the claim, given the tools to do it, and believed when it succeeds. Two
  passes (initial and delta) caught, in one lane alone: an occlusion that made
  the whole fix invisible, a capture that photographed black on a class of
  renderers, and two bounded liveness nuances now recorded in the worklog.
- **Gates every time:** `npm run audit:tokens` (the one check CONTRIBUTING.md
  makes build-gating; run it before every commit), `npx tsc --noEmit`,
  `npx eslint` on touched paths, `npx tsx
  scripts/location-default-contract.test.ts` when the map is touched, `npx
  knip` filtered to your files for new flags, and the worklog contract test
  when a log is touched. Report verbatim tails, not summaries.

## 5. Working beside the controller

The controller owns `LANES.md` policy, sequencing, and promotion. A contractor
makes the controller's job lighter by:

- entering through evidence, not through opinion, so every lane proposal
  arrives pre-verified;
- keeping claims so narrow that reconciliation is a glance;
- flagging governance conflicts instead of resolving them mid-lane (the
  self-append versus controller-ownership tension in the claim procedure was
  flagged in a claim's own text and left for governance);
- spawning a scoped task chip when out-of-lane breakage is found, so the
  controller can route it rather than absorb it;
- recording every disclosure (foreign guard kept, peer landing, pre-broken
  gate) where the next auditor will actually look: the worklog and the commit
  message, not chat.

Silence is not authorisation, a push is a deploy, and the Founder outranks
every file, within the decision record's own shape: final product authority
does not silently bypass an accepted ADR, it directs a superseding one. When
the owner is present and directing, their word governs; when they are away,
the narrowest reading of the standing record governs. The
asymmetry is deliberate: an unsupervised mistake here reaches real users buying
real food.

## 6. Staying in the loop

Idle seats stay pinned, not dissolved. A contractor between lanes:

1. keeps a watcher on the hot files it is queued behind instead of polling by
   hand;
2. re-reads the worklogs' `Exact next action` and Unknown scopes for its
   functional home on each return, because those are standing assignments;
3. checks whether any queued gate it can satisfy has cleared (a released Maps
   lock unblocked the Presence serialization this cycle; whoever notices first
   should say so in their release note);
4. returns to idle honestly when nothing bounded exists, rather than inventing
   scope. An interesting idea goes to the portfolio register, not into a lane.
