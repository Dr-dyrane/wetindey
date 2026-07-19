# WetinDey

> **Know before you go.**

WetinDey is a map-and-sheet Progressive Web App for Nigerian street-food prices.
It helps people find where a specific food item is recently confirmed nearby,
understand its current price or price range for a defined unit, and decide where
to go with visible freshness and trust signals.

*Wetin dey?* is Pidgin for "what's happening?".

The pilot is south-west Lagos, opening on D Close, 6th Avenue, Festac.

---

## Get it running

Five commands, in this order. Read the PostGIS note before the last one.

```bash
git clone <this-repo> && cd wetindey
npm install
cp .env.example .env.local     # then fill in the two required keys
npm run db:seed                # creates PostGIS, migrates, then seeds
npm run dev                    # http://localhost:3000
```

### Prerequisites

| | |
|---|---|
| **Node** | 20+ (developed on 24.x). `npm run db:seed` uses `--env-file`, which needs 20.6+. |
| **npm** | 10+ |
| **A Postgres database** | Neon is what this targets. **You must be able to `CREATE EXTENSION postgis` on it** — see below. Neon allows this on the free tier. |
| **A Mapbox account** | For a free public token (`pk.…`). Without it the map is blank and says nothing about why. |

### The two keys you actually need

`.env.local` needs exactly two variables set for the app to work:

- `DATABASE_URL` — your Neon connection string
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` — a Mapbox public token

Everything else in `.env.example` is optional (Sentry, `APP_ENV`) and the app
runs correctly without it. `.env.example` documents which file reads each key.

> **If your map is blank, this is why.** The Mapbox token is read in
> `MapboxAdapter.ts` (the constructor) and `MapboxCanvas.tsx`, and both fall back to `""`
> rather than throwing. A missing or misnamed token produces an empty grey
> canvas and no error anywhere. Check the name character for character — it is
> `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, not `NEXT_PUBLIC_MAP_TOKEN`. (`.env.example`
> declared the wrong one until recently, so anyone who bootstrapped from it
> before this commit hit exactly this.)

---

## The PostGIS gotcha

**`npm run db:migrate` does not work on a fresh database. Use `npm run db:seed`.**

This is not a preference. The migration at
`src/db/migrations/0000_careless_piledriver.sql` declares `geography` columns
(`:7`, `:85`) but never creates the PostGIS extension that defines that type.
Run `drizzle-kit migrate` against a clean database and it fails with:

```
type "geography" does not exist
```

The `CREATE EXTENSION IF NOT EXISTS postgis` lives in the seed instead
(`src/db/seed.ts`), which then calls `migrate()` itself. So the seed
is the only path that bootstraps a database correctly:

```
npm run db:seed
  └─ 1. CREATE EXTENSION IF NOT EXISTS postgis   seed.ts
     2. migrate()                                seed.ts
     3. TRUNCATE every table (idempotent)        seed.ts
     4. insert units → items → … → observations → offers
```

Two consequences worth internalising:

- **`db:seed` is destructive.** It truncates every table before inserting. That
  is deliberate — it makes re-seeding idempotent — but never point it at
  anything you care about.
- **The seed writes observations first and derives every offer field from
  them.** Offers are not independent rows you may hand-edit; freshness,
  `expiresAt` and `supportingObservationCount` are all computed from the
  observations that back them (`src/db/seed.ts`). Do not undo this. It
  is the difference between real trust signals and fabricated ones.

### A second, quieter trap

`drizzle-kit` loads **`.env`**, not `.env.local`. `npm run db:seed` passes
`--env-file=.env.local` explicitly and is fine; `next dev` reads `.env.local`
automatically and is fine. But `db:generate` and `db:migrate` see neither — and
`drizzle.config.ts` reads `process.env.DATABASE_URL || ""`, so an unset URL
becomes an empty string rather than an error. If those commands behave as though
you have no database, this is why. Pass the variable explicitly:

```bash
DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)" npm run db:migrate
```

---

## npm scripts

| Script | What it does | When you need it |
|---|---|---|
| `npm run dev` | Next dev server on :3000. Reads `.env.local` automatically. | Daily. |
| `npm run build` | Production build. | Before pushing anything structural. |
| `npm start` | Serves the production build. | Checking PWA/offline behaviour, which `dev` misrepresents. |
| `npm run lint` | ESLint via `eslint-config-next`. | Daily. |
| `npm run format` | Prettier over `src/**`, including Tailwind class sorting. | Before committing. |
| `npm run db:generate` | `drizzle-kit generate` — diffs `src/db/schema/index.ts` against the last snapshot and writes a new SQL migration into `src/db/migrations/`. Does **not** touch the database. | After editing the schema. Commit the generated SQL *and* the `meta/` snapshot. |
| `npm run db:migrate` | `drizzle-kit migrate` — applies pending migrations. **Fails on a fresh database** (see PostGIS gotcha) and does not read `.env.local`. | Applying a migration to a database that already has PostGIS. |
| `npm run db:seed` | Creates PostGIS → migrates → **truncates everything** → seeds. The only command that bootstraps a database from nothing. | First run, and whenever you want a clean known dataset. |
| `npm run audit:tokens` | Fails on hardcoded colours and on any border/ring/hairline. **This gates the build.** | Before every commit. See `docs/CONTRIBUTING.md` for why it exists. |

There is no test script. There are no tests. Do not read `npm run build`
passing as "it works".

---

## What's in the pilot dataset

After `npm run db:seed`: 20 units · 38 items · 87 aliases · 79 variants ·
9 areas · 60 places · 478 offers · 942 observations.

---

## Read these before you write code

**`docs/DECISIONS.md` first, and it is not optional.** It indexes the ADRs, and an ADR
beats every other document here. Then
`docs/architecture/SERVICE-ARCHITECTURE.md` — the architecture of record — starting
with its *Read this first* section.

**Precedence, when documents disagree:** an ADR beats every other document; the
architecture of record beats the Bible and `docs/`; **the code beats all of them.**
If the code contradicts a document, the document is the bug — fix it, or say so.

| Document | What it's for |
|---|---|
| `docs/DECISIONS.md` | The ADR index. **Start here.** An ADR overrides every other doc. |
| `docs/architecture/SERVICE-ARCHITECTURE.md` | The architecture of record — what actually exists, with citations. |
| `LANES.md` | Who is editing what right now. **Read before your first edit.** |
| `docs/CONTRIBUTING.md` | The house rules, and — more usefully — why each one exists. |
| `docs/USER-FLOW.md` | The core loop, and what's built versus what isn't. |
| `docs/APPLE-HIG-MAPPING.md` | Where the visual language comes from, and where we chose. |
| `docs/WETINDEY_BIBLE.md` | The product constitution. Long. |
| `docs/APP-MAP.md` | **Emptied 16 July 2026** — it was substantially false. A tombstone, kept only so links do not dangle. |

> This section told you to read `APP-MAP.md` first, and called it "a verified map
> …143 claims of which 112 survived adversarial refutation". It was emptied on
> 16 July 2026 for being confidently wrong, including about its own headline
> finding. A document that is trusted and false is the most expensive kind here —
> which is the whole reason precedence is written down above.

### One thing to know before you read any code

This repo contains two versions of itself: a thoughtful one that is **dead**,
and a crude one that **runs**.

`src/lib/trust.ts` holds the only real trust model — age-decayed confidence, a
`{staleHours: 24, expirationHours: 72}` policy, per-source caps — and **nothing
renders it**. Its two server actions, `getOfferTrust` and `getOfferTrustBatch`,
have no callers. Meanwhile `getFoodItemCandidates` fakes confidence with
`supportingObservationCount * 10`, every write stamps the literal string
`trustLevel: "high"`, and the badge you actually see is computed by `offerSignal`
inside `ItemDetailSheet.tsx` — which `page.tsx` imports back out of a sheet to
colour the map pins. Four derivations, and the good one is dead.

> This paragraph named `FoodModule.ts` and an xstate `reportingMachine.ts` until
> 16 July 2026. Both were deleted in `add5fd3`, along with xstate and jotai —
> and `trust.ts` was written to rescue `FoodModule` and orphaned identically.
> The disease survived the cure. `knip` now blocks in CI so the next one cannot
> reach `main`; see [ADR-002](docs/adr/002-service-architecture-of-record.md).
> Roadmap Phase 1 makes `trust.ts` the sole model — [ADR-006](docs/adr/006-freshness-windows.md).

When you need one of these behaviours, wire up what exists. Do not write a third
copy. `docs/APP-MAP.md` §7 has the full inventory.

### And a caveat on the directory layout

`src/db/queries/` and `src/db/schema/`'s `.gitkeep` files imply a structure that
was never built. `src/db/seed/` is an **empty scaffold directory that name-
collides with the real `src/db/seed.ts`** — the seed is the file, not the
folder. Don't go looking in the folder for it.

---

## Non-negotiables

- One complete problem before additional modules.
- Map first, never map only.
- Availability plus price, not price alone.
- Every price has a unit and semantic type.
- Every current claim has freshness and provenance.
- Anonymous browsing, optional recognition. Reading never needs an account; signing
  in is how a contributor earns a reputation. Auth is recognition, never a gate.
- Progressive disclosure.
- No fake certainty.
- No paid organic ranking.
- Accessibility, offline behaviour, dark mode, and failure states are part of
  the product.

## Stack

Next.js 15 App Router · React 19 · TypeScript · Tailwind · Drizzle ORM +
Neon Postgres + PostGIS · Mapbox GL (loaded from CDN) · Zustand · Zod ·
Neon Auth (email OTP) · PWA. Deployed on Vercel.
