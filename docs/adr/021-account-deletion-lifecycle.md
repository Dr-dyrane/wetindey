# ADR-021: Account deletion lifecycle

**Date:** 2026-07-18
**Status:** Accepted - P1 implemented at `4d7038c` (deletion-saga persistence and provider boundary) and P2 at `f775459` (cleanup adapters and orchestration, inert; `src/lib/deletion/`); P3 self-delete exposure unclaimed
**Decision owner:** WetinDey Founder

## Context

Deleting a Neon Auth identity is necessary and insufficient. WetinDey also holds an
application profile, avatar objects, contributor attribution, free-text problem reports,
and—after Presence rollout—short-lived presence and safety records. These systems cannot
be changed atomically with the Auth provider.

A single request that says “success” after only deleting Auth would strand personal data.
Deleting application data first would leave a live identity able to recreate or mutate
records during cleanup. The safe design is a persisted, idempotent saga: authenticate the
request strongly, record it durably, delete the Auth identity, then retry every required
cleanup until deterministic completion.

## Decision

WetinDey will implement account deletion as a server-owned, persisted saga. The browser
never receives a Neon administrative credential and never calls the administrative Auth
deletion API directly.

### Authorization and challenge

Deletion requires:

1. an existing authenticated session;
2. a short-lived, single-use deletion challenge bound to that account, session, request
   intent, and expiry;
3. fresh verification through the existing email OTP/re-authentication mechanism; and
4. server-side attempt limits, replay denial, and expiry.

Only a hash of the challenge is persisted. Email, OTP, session token, and raw challenge
must not enter saga or audit rows. Verification creates or resumes one active deletion
request for the account; repeated submissions return the same request and phase.

### Exact-target administrative Auth deletion

The Auth identity is deleted through Neon’s server-only branch administrative capability.
The worker must prove the expected project/branch/environment before use and must fail
closed on mismatch, missing capability, or ambiguous provider response. Preview and
Production are separate targets and require separate capability evidence. No public
client key, browser token, normal user session, or database credential substitutes for
the branch administrative authorization.

### Persisted saga

Each request has a random request identifier, an idempotency key, current phase, phase
attempt count, next retry time, created/updated timestamps, and terminal status. Phase
transitions use compare-and-set or equivalent transaction protection so two workers
cannot advance the same phase twice.

Canonical phases:

1. `challenge_pending`
2. `verified`
3. `auth_delete_pending`
4. `auth_deleted`
5. `app_cleanup_pending`
6. `presence_cleanup_pending`
7. `blob_cleanup_pending`
8. `completed`

Deterministic failure states are:

- `verification_expired`: no destructive work occurred; a new challenge is required;
- `auth_delete_retryable`: Auth deletion is not proved; application cleanup must not
  start;
- `cleanup_retryable`: Auth deletion is proved and the recorded cleanup phase will retry;
- `blocked_manual`: an invariant, target mismatch, or non-retryable provider response
  requires authorized operator review; and
- `completed`: every mandatory phase has a durable success receipt and verified counts.

There is no rollback after `auth_deleted` and no attempt to recreate the identity. A
partial post-Auth failure remains `cleanup_retryable` or `blocked_manual`, never
“completed.” Retries are phase-idempotent and resume from durable state without requiring
the now-deleted Auth identity.

### Ordered deletion policy

After Auth deletion is proved, retryable cleanup performs all of the following:

| Data | Required outcome |
|---|---|
| `user_profiles` | Delete the account row |
| Avatar Blob objects | Enumerate and delete every exact `avatars/{userId}.` object, not only the URL currently stored on the profile |
| `sources.user_id` | Set to `NULL`; retain the source row |
| `observations` | Retain unchanged, including source linkage; do not rewrite authorship or evidence |
| Ordinary account-linked `problem_reports` | Delete because free-text may contain personal data |
| Presence | Invoke the accepted Presence account-deletion boundary and prove its result |
| Presence safety records | Retain only approved minimal tombstoned safety metadata; clear details and identifiers not required by that policy |

Profile deletion must not erase the internal user identifier needed by later saga phases;
the saga keeps it encrypted or equivalently protected until cleanup completes, then
removes it under the saga-retention policy. Blob cleanup lists every page for the exact
prefix and treats “already absent” as idempotent success only after enumeration proves no
matching object remains.

Setting `sources.user_id` to `NULL` preserves immutable observations without continuing
to identify the deleted account. Observations are neither deleted nor rewritten.

Ordinary `problem_reports` linked to the account are deleted in full, including free text
and metadata. A record separately promoted into an approved Presence safety case follows
the safety tombstone policy instead; ordinary support/problem text is not retained by
relabelling it “safety.”

### Presence integration

Account deletion invokes one idempotent Presence account-deletion operation. It revokes
and purges active leases, preferences, profile consent, snapshot capabilities, Waves, and
other account-resolvable presence state. New presence reads/actions for the account fail
closed from the first successful invocation.

Blocks, reports, and related safety material retain only minimal tombstoned metadata
allowed by the approved safety-retention schedule. Free text, coordinates, capabilities,
display name, avatar, contact data, stable Auth identifier, and unnecessary relationship
details are cleared. The tombstone contains only a random record identifier, safety
record class, lifecycle/disposition fields, coarse administrative timestamps where
approved, and purge deadline. It cannot feed profiles, reputation, verification, ranking,
or nearby discovery.

ADR-016 is amended by this decision: engineering no longer needs renewed Founder product
approval for these deletion semantics. Exact retention durations and qualified legal
review remain environment/release gates where required.

### Minimal audit and purge

Deletion audit contains only:

- random deletion request identifier;
- phase name;
- attempt number;
- affected-row/object counts;
- outcome class; and
- redacted error code/category.

It must not contain user ID, email, OTP, session/challenge, profile fields, report text,
coordinates, Blob URL/key, raw provider response, stack trace, or deletion payload.
Saga/audit rows are purged after the approved retention period. Redaction happens before
persistence, logging, tracing, analytics, or alert transport.

### Truthful UI and completion

Until this saga, exact-target Auth capability, every cleanup adapter, retry worker,
status recovery, and end-to-end proof exist, WetinDey must not expose an enabled
self-delete control or claim account deletion is available.

Request acceptance, OTP success, Auth identity absence, profile deletion, or a queued
cleanup is not completion. Only terminal `completed` may drive “Account deleted” copy.
Partial failure copy states that cleanup is still in progress or requires support without
exposing internal identifiers.

## Post-0012 implementation ordering

Corrected Presence migration `0012` must be applied and independently proved on the exact
target before account-deletion schema or Presence cleanup integration is activated.
Migration numbers are assigned by the controller at activation; this ADR does not steal
`0013` from the separate contribution-integrity packet.

### P1 — persistence and provider boundary

Future exact claim:

- deletion-request/phase/audit schema declaration;
- the next controller-assigned migration and its snapshot/journal evidence;
- a server-only Neon branch administrative Auth adapter;
- exact-target/environment guards; and
- phase transition/idempotency worker primitives.

P1 owns no UI, Blob deletion, Presence UI, or public action. Exit requires disposable
fresh/upgrade migration proof and provider-capability refutation without deleting a real
shared account.

### P2 — cleanup adapters and orchestration

Future exact claim:

- profile deletion;
- `sources.user_id` nulling with observation preservation proof;
- ordinary `problem_reports` deletion;
- exact-prefix paginated Blob enumeration/deletion;
- idempotent Presence account-deletion invocation and safety tombstoning; and
- retries, backoff, terminal/manual states, redacted audit, and purge.

P2 begins only after P1 and corrected `0012` exact-target proof. It owns no public
completion UI.

### P3 — user flow and end-to-end release evidence

Future exact claim:

- short-lived challenge and existing email OTP/re-auth flow;
- deletion request, status, retry/support, sign-out, and terminal-completion UI;
- accessibility and failure-state copy; and
- two-account, partial-failure, retry, provider, Presence, Blob, audit-purge, and
  no-resurrection end-to-end scenarios.

P3 may expose self-delete only after P1/P2 pass independently and the full saga is driven
in each authorized environment.

## Validation gates

Independent security/privacy review must try to refute:

- browser or user-session access to administrative deletion;
- wrong Neon branch/project deletion;
- challenge replay or stale authentication;
- duplicate requests or concurrent phase advancement;
- cleanup starting before Auth deletion is proved;
- observation deletion or mutation;
- retained `sources.user_id`;
- surviving exact-prefix avatar objects;
- retained ordinary problem-report text;
- incomplete Presence revocation or non-minimal safety tombstones;
- PII in audit/log/error systems;
- false terminal completion; and
- inability to resume after the Auth identity is gone.

## Consequences

- Deletion is asynchronous and may outlive the initiating session.
- Auth-first ordering makes post-provider cleanup reliability a P0 operational duty.
- Immutable observations survive without account attribution.
- Safety retention is minimized and time-bounded rather than erased indiscriminately or
  retained in full.
- No implementation, provider call, database change, UI, deployment, or rollout is
  authorized by this documentation commit.
