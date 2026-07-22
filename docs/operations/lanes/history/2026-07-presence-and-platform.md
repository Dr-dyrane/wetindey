# Historical Lane Archive: presence and platform

Historical evidence only. This file grants no current path ownership, release permission, provider access, migration authority, or deployment authority. For active locks and gates, read root [LANES.md](../../../../LANES.md).

- Source snapshot commit: `63d927a`
- Extraction method: exact heading block bytes from `LANES.md` at the source snapshot
- Integrity: each block SHA-256 is listed in [this archive index](README.md)

## Records

<a id="2026-07-presence-and-platform-01"></a>

#### Nearby Presence retention scheduler — closed / released

Owner: Nearby Presence Platform Engineer. Exact paths:

- new `src/app/api/internal/presence/retention-cleanup/route.ts`
- new `src/lib/presence-retention-cleanup.ts`
- existing `vercel.json`
- existing `.env.example`
- new `scripts/presence/presence-retention-cleanup-contract.test.ts`

Production operational evidence now **PASS**es: the least-privilege scheduler uses the
dedicated safety database, has the required credential/deployment, returns `204` for
cleanup, and proves retention. It remains GET-only, `CRON_SECRET` protected, and executes
exactly `SELECT public.presence_run_retention_cleanup()` without any `DATABASE_URL`
fallback. Release all five paths. The reciprocal product surface remains default-off with no
peers; this operational PASS does not wire Presence UI.


<a id="2026-07-presence-and-platform-02"></a>

#### Nearby Presence `0012` execution-role portability correction — closed / released

Status: closed / released Production operational PASS. Former exact paths:

- `src/db/pillars/90-presence-security.sql`
- `src/db/migrations/0012_guarded_presence.sql`
- `scripts/presence/presence-migration-contract.test.ts`

Production `0012` is operational **PASS**. The exact Production ledger/hash and declared
schema/RPC/RLS/grant fingerprint match the proven release parent; the target identity remains
the exact HMAC match already recorded across authority, compute, database, principal,
options, and deployment. Production idempotence, least-privilege scheduler, cleanup `204`,
retention, default-off/no-peer containment, and independent operational refutation all
passed. Release the three exact paths. The `0012` snapshot and journal remain byte-identical
and every `0011` byte remains frozen.


<a id="2026-07-presence-and-platform-03"></a>

##### Trusted People / Remote Presence governance — COMPLETE / RELEASED

Owner: Product & Data Governance Architect `019f7599-0eaa-7423-9ebf-a1bfea8efe37`.
Exclusive documentation-only paths:

- `docs/adr/025-trusted-people-remote-presence.md`
- `docs/DECISIONS.md`
- `docs/WETINDEY_BIBLE.md`
- `docs/architecture/SERVICE-ARCHITECTURE.md`

Define invite/accept/revoke Trusted People, remote-view consent, audience and expiry,
block/report priority, non-discoverability, no follower/popularity semantics, and the
separation between truthful physical presence and a selected browsing area. This lane has
no schema, migration, server, provider, or UI authorization and does not supersede the
active pathless `0014` shared-target operational gate.

Completed and independently accepted in `51de20a`; all four documentation paths are
released.

