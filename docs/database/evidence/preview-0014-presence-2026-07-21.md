# Presence `0014` shared-target reconciliation

**Status:** independently proved operational PASS on Preview and Production. This packet is
redacted database evidence, not runtime, pilot, deployment, or rollout authorization.

## Frozen release

- Release: `0014_presence_capabilities`
- SQL SHA-256: `ed532eab5f7941245cfebb66463a2194ab9df235b30f9fd678e1c0e1065008bf`
- Exact ledger: immutable `0000` through `0014`
- Shared result fingerprint: `a0126839bc0671fff9b9ad3bc4954e3dfb2286fccdbb352651a199f74b23ab03`
- Project: `wild-rain-23091788`
- Database: `neondb`
- Migration role: `neondb_owner`

## Exact targets and packets

| Target | Branch | Endpoint hostname SHA-256 | Redacted audit packet SHA-256 |
|---|---|---|---|
| Production | `main` / `br-flat-band-aui9waf5` | `49e9bfbdb1d253190391c88980d8b293eb8da2eaae1af606defecb4bb3542804` | `1a872cfdc03c71cf31c7c96c88609c5cd91a349acb6ee58d4b463e3f82faa258` |
| Preview | `preview/wetindey-presence` / `br-steep-dust-auhcmjk8` | `b47f36e8b9349d0e686b0468c2d41c0b3209911576abaa3af8fb2f14d344beaf` | `f5ed59e18f1745c6b2e7d5a3518bc3322b313ea1fd2671f5398aa8844328ee7f` |

Canonical provider identity packet SHA-256:
`7744db329e61aa7a4e34a240454f9f23bf5c66bd99c92b2d446d2788efe2ffc7`.

## Proven postconditions

Both targets independently match the exact `0000`-`0014` ledger, migration hash, and
schema/RPC/RLS/grant fingerprint. Both retain `operations_allowed=false` and
`runtime_allowed=false`, an empty allowlist, no active Presence leases/Waves/capabilities,
safe NOLOGIN/NOBYPASSRLS Presence roles, and no retained migration-principal SET path or
Presence-owner CREATE privilege on `public`.

Preview physical inheritance evidence records parent LSN `0/7368FF50` at
`2026-07-21T22:29:06Z`, branch creation at `2026-07-21T22:29:18Z`, `xmin` `228412`, and
relfilenode `368692`. This supports physical inheritance rather than a duplicate Preview
execution.

## Evidence boundaries

No credential, hostname, connection URL, or password is recorded here. No pre-application
backup identifier or commit time is known from the supplied operational packet, so neither
is invented. The completed migration must not be rerun. Any defect is repaired forward
under ADR-014.

Migration completion does not turn on either control plane, populate pilot participants,
wire peer UI, authorize location processing, satisfy privacy/safety/legal policy, deploy
code, or permit public rollout. Those remain separate fail-closed decisions.

## Read-only reconciliation

The repository reconciler accepts exactly one explicit target and its exact branch:

```sh
unset DATABASE_URL
export PRESENCE_0014_PREVIEW_DATABASE_URL_UNPOOLED='<authorized Preview read-only audit URL>'
node scripts/presence/presence-0014-preview-preflight.mjs \
  --target=preview --branch=preview/wetindey-presence
```

```sh
unset DATABASE_URL
export PRESENCE_0014_PRODUCTION_DATABASE_URL_UNPOOLED='<authorized Production read-only audit URL>'
node scripts/presence/presence-0014-preview-preflight.mjs \
  --target=production --branch=main
```

The reconciler performs only bounded read-only queries, redacts secrets and hostnames, and
requires exact immutable result state. It has no migration or subprocess mode.
