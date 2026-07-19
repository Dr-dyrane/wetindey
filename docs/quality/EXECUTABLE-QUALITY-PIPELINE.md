# Executable quality pipeline

## Slice A boundary

Slice A makes the repository's existing deterministic checks visible as required CI
stages. It does not add a test framework, browser automation, database access, provider
actions, migrations, seeds, deployment, or production secrets.

The stage runner is [scripts/quality/run-stage.mjs](../../scripts/quality/run-stage.mjs).
It owns a fixed command list for each stage, runs commands serially, fails fast, and
returns non-zero for an unknown stage, a missing executable, a missing contract file, a
signal termination, or a failed command. It does not conditionally skip a command based
on environment variables and does not use a shell.

## Local stages

Run these commands from the repository root after `npm ci`:

| Stage | npm command | Contents |
| --- | --- | --- |
| Static contracts | `npm run quality:stage:static` | Token audit plus the checked-in source, ingestion, contribution-action, presence-retention, CSP, iconography, location, sheet, auth-email, and Q1 contract scripts that are safe and aligned for this CI boundary. |
| Typecheck | `npm run quality:stage:typecheck` | Existing `tsc --noEmit` gate. |
| Dependency hygiene | `npm run quality:stage:dependencies` | Existing `knip` gate for unused code and dependencies. |

The runner also exposes `node scripts/quality/run-stage.mjs --list` for the exact stage
names. Existing commands such as `npm run typecheck`, `npm run audit:tokens`,
`npm run test:auth-email`, and `npm run knip` remain unchanged.

## CI wiring

`.github/workflows/ci.yml` runs three independent GitHub Actions jobs:

- `quality-static` runs the static contracts stage.
- `quality-typecheck` runs the TypeScript stage.
- `quality-dependencies` runs the Knip stage.

Each job pins Ubuntu 24.04, Node 22.14.0, the checkout/setup action revisions, and
`npm ci`. No job declares or requires Production secrets. A safe prerequisite that is
missing in CI fails the runner honestly; it is never converted into a green skip. There
is no `continue-on-error`. Making a job a protected required check remains repository
branch-protection configuration outside this workflow.

## Deliberate exclusions

These existing commands and contracts are not Slice A stages because they cross a
prohibited boundary or are not deterministic local contracts:

- `db:migrate`, `db:seed`, and `db:recompute-bands` access or mutate database state.
- `scripts/contributions/contribution-migration-contract.test.ts` exercises disposable
  migration and seed-style database fixtures and may use a native database URL.
- `scripts/ingestion/fetch-nbs-selected-food-price-watch.ts` performs provider/network
  ingestion.
- `scripts/motion-contracts.test.ts` is currently stale against the active `page.tsx`
  compact-detail structure; its Motion owner must reconcile the contract before it can
  become a required stage.
- `scripts/presence/presence-migration-contract.test.ts` currently asserts the old `0012`
  journal tail while the repository has a later `0013` entry; its migration owner must
  reconcile the frozen-prefix assertion before it can become a required stage.
- Browser suites and Playwright configuration do not exist in this slice.

These two stale contracts are explicit residual gates, not environment-conditional skips:
the runner has no hidden discovery or optional-command behavior, and the documentation
names the owner-held correction required before wiring them.

Slice B is future work for guarded disposable-database and Server Action integration
checks. Slice C is future work for Playwright hero, accessibility, and PWA checks. Both
remain pathless and are not implied by this CI wiring.
