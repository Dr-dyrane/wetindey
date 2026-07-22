# ADR-028: Contribution evidence-media is optional, moderated, and fail-closed

**Status:** Proposed
**Date:** 2026-07-22
**Decision owner:** Founder
**Scope:** Whether and how an optional user photo may accompany a Food price report,
its admission, moderation, retention, privacy, Blob storage layout, and display gating

> This decision records proposed policy only. It authorizes no lane, no schema, no
> migration, no Blob container or provisioning, no application code, no deployment, and no
> rollout. Acceptance does not claim `0017+` or any later migration number, does not open a
> media upload path, and does not enable any public projection. Implementation, if any, is a
> separately claimed and independently refuted lane.

## Context

[ADR-019](019-contribution-integrity-and-moderation.md) makes public Food reporting flow
through a transactional, idempotent, rate-enforced, fail-closed pending-evidence boundary,
and moderation is the only path from a submitted report to a public projection. Its
Non-goals list explicitly leaves one question open: it does not "define evidence-media
retention." That gap is unresolved, so no photo may accompany a report until a decision
fills it. This ADR fills exactly that gap and nothing wider.

The question is narrow: a person filing a price report may want to attach one corroborating
photo, for example a shelf tag or a market stall showing the item and price. A photo can
help a moderator, but it is not the claim, it carries camera EXIF and possibly faces or
bystanders, and an unmoderated public image is a privacy and abuse surface.

Adjacent decisions bound this one. [ADR-013](013-public-source-ingestion-boundary.md)
governs external evidence through a separate staging and review firewall, so a
contributor's own photo is not third-party ingestion and third-party images are not a
contributor photo. [ADR-015](015-observation-provenance-admissibility.md) keeps confidence
earned from admissible `observed` evidence and keeps synthetic content labelled `Sample`, so
media can never manufacture confidence or corroboration.
[ADR-021](021-account-deletion-lifecycle.md) already enumerates and deletes a user's Blob
objects by exact prefix, avatars-style, and this ADR must plug evidence-media into that same
saga. [ADR-023](023-browsing-context-and-device-location.md) governs location disclosure, so
a photo's embedded geo cannot become an undisclosed location signal.

## Decision

An evidence-media photo may optionally accompany a Food price report. Media is corroborating
evidence attached to a report, never the report itself and never a standalone claim. It
enters the same fail-closed pending boundary as the report defined by ADR-019, is not public
until an authorized moderation decision approves it, is stripped of embedded metadata on
ingest, and renders only for approved reports with a labelled provenance.

The following invariants are proposed as consistent with ADR-019's pending-evidence and
moderation model and with ADR-013, ADR-015, and ADR-021.

## Invariants

### 1. Media is optional, corroborating, and never self-approving

Evidence-media is always optional. A report is complete and admissible with no photo, and
the absence of a photo is never a defect, a lower status, or a prompt that pressures
attachment. A photo is corroborating evidence for the report's claim, not the claim: the
availability and price assertion still comes from the typed report payload governed by
ADR-019, and a photo neither supplies nor overrides availability, price, unit, place, item,
or observation time.

Attaching a photo never advances moderation state. Media does not auto-approve a report, does
not raise confidence, does not count as independent corroboration under ADR-015, and does not
substitute for the independent approved evidence ADR-019 requires before an availability
change or a projection transition. A moderator approving a report is a human decision about
the report and its evidence together, never an automatic consequence of a photo being
present, clear, or high-resolution.

### 2. Media enters the same fail-closed pending boundary and is sanitized on ingest

Media admission is bound to report admission. A photo enters as pending evidence of one
report inside the same ADR-019 boundary: it is not public on upload, it is subject to the
same idempotency, rate, and authorization contract, and a media upload that is not durably
bound to an admitted report leaves no orphaned public object. Upload acceptance means
received for review, never published, approved, or verified.

On ingest, before any durable retention, media is sanitized:

- all embedded metadata is stripped, including EXIF, GPS and geolocation tags, device and
  camera identifiers, timestamps, thumbnails, and maker notes, so a photo cannot become an
  undisclosed location or identity signal outside ADR-023;
- content is re-encoded to a normalized, stripped derivative rather than storing raw
  camera bytes, and only the sanitized derivative is retained; and
- size, type, and count limits are enforced fail-closed, so only a small allowed set of
  image types, a bounded byte size, and a low bounded count per report are admitted, and
  anything outside the limits, or any type or payload that cannot be safely decoded and
  re-encoded, is rejected rather than stored.

Pending media follows the report: it is not public, does not appear in any public read, and
cannot influence a public projection while the report is pending, rejected, superseded, or
otherwise inadmissible.

### 3. Retention is tied to the report lifecycle and lawful data-subject handling

Evidence-media persists only as long as its bound report justifies, and no longer:

- pending media is retained only while the report is pending moderation, and expires under a
  bounded pending window rather than persisting indefinitely awaiting a decision;
- approved media is retained while the approved report remains part of the admissible
  evidence set, and is removed or made inaccessible when the report is superseded, corrected
  away, or its approval is reversed by a later moderation decision;
- rejected media is not retained as public evidence and is purged under a bounded
  short retention after the rejecting decision, keeping only the minimal non-image audit
  reference ADR-019 requires to reconstruct that a submission and its decision occurred; and
- lawful data-subject handling may require earlier removal of a specific object, which
  redacts the separately governed personal data without rewriting or fabricating the
  historical report claim, consistent with ADR-019 invariant 1.

Account deletion removes evidence-media through the existing ADR-021 saga. Its ordered
cleanup enumerates and deletes every evidence-media object belonging to the account by exact
prefix, the same avatars-style exact-prefix, paginated enumeration ADR-021 already applies to
avatar objects, and treats "already absent" as idempotent success only after enumeration
proves no matching object remains. Deleting media does not delete or rewrite the immutable
observation, consistent with ADR-021's observation-preservation rule.

### 4. Privacy: no exposed faces or PII, encrypted storage, least-privilege access

Media handling minimizes personal exposure at every stage. The policy is that a public photo
must not expose recognizable faces, bystanders, license plates, or other personal
identifiers unrelated to the price claim; media that cannot meet that bar is not approved for
public display. Contributors are guided to photograph the item and price, not people.

Storage is encrypted at rest and in transit. Access is least-privilege: pending and rejected
media, moderator notes, and internal review context are reachable only by separately
authorized, least-privileged moderation, exactly as ADR-019 requires for private evidence and
moderation material. Public responses never leak private media, pending or rejected media,
raw or unsanitized bytes, embedded metadata, storage keys, contributor identity beyond
approved attribution, or moderator notes.

### 5. Blob storage layout enumerates deterministically by report

Evidence-media objects use a deterministic, report-scoped key prefix so deletion and
moderation can enumerate exhaustively without a scan. The proposed layout is:

```
contribution-evidence/{reportId}/{mediaId}.{ext}
```

Every object for one report lives under the exact `contribution-evidence/{reportId}/` prefix.
This lets moderation list all media for a report deterministically, and lets both ADR-019
moderation cleanup and ADR-021 account-deletion cleanup enumerate the exact prefix
page-by-page and prove no object remains, the same enumerate-then-delete contract ADR-021
applies to `avatars/{userId}.`. Keys are opaque, contain no personal data, and are never
returned in public responses.

### 6. Display gating: approved reports only, labelled provenance, never standalone truth

Media renders only for a report whose current effective moderation state is approved and
admissible. Pending, rejected, superseded, expired, and inadmissible reports display no
photo. A withdrawn approval removes the photo from public display in the same decision that
changes the projection.

When shown, a photo is presented as labelled contributor-provided corroborating evidence
attached to a specific approved report, never as standalone truth. It does not, by itself,
set availability, price, or confidence, all of which continue to come from the admissible
`observed` evidence set under ADR-015. A photo is never presented as `E sure`, confirmed,
verified, or a current claim on its own, and copy, status, and structured data around it must
agree that the evidence is the moderated report, corroborated by the photo, not the photo
alone.

## Consequences

**Improves.** Contributors can optionally strengthen a report with a corroborating photo,
moderators get better context, and the platform gains this without opening a privacy or abuse
surface: media is optional, sanitized, moderated, retention-bounded, deletion-enumerable, and
gated to approved reports.

**Costs.** Media adds ingest sanitization, encrypted bounded storage, a moderation surface
for images, retention and expiry jobs, privacy review, an added ADR-021 cleanup phase, and
adversarial testing of upload, moderation, deletion, and display. Publication stays slower
because media, like the report, is admitted separately from approval.

**Constrains.** No photo may auto-approve a report or raise confidence, no unmoderated media
is ever public, no raw or metadata-bearing bytes are retained, no evidence-media object
escapes the report-scoped prefix, and no media may be presented as standalone truth.

## Non-goals

This ADR does not:

- create a photo gallery, album, or media browsing surface;
- create a social feed, likes, comments, or any social distribution of photos;
- permit media-only reports; a photo never exists without an admitted report claim;
- rank, sort, weight, or prioritize reports, sellers, places, or projections by the
  presence, count, resolution, or quality of media;
- ingest third-party, web, partner, or public-source images, which remain governed by the
  separate ADR-013 staging and review firewall;
- add video, audio, documents, or any non-image media;
- design the moderation UI, the upload UI, reputation, or rewards;
- change ADR-015 admissibility, confidence, or the `Sample` treatment;
- authorize a lane, schema, migration, Blob container or provisioning, application code,
  deployment, or rollout; or
- access, modify, or provision any database or storage.

## Review triggers

Review this ADR before the first evidence-media schema or storage is claimed, before any
media upload path is enabled, before media is admitted to any public display, after any
change to ADR-019 moderation thresholds or the pending boundary, after any change to ADR-021
account-deletion cleanup ordering or prefix scheme, after any change to ADR-023 location
disclosure, and after any privacy or integrity event in which pending, rejected,
unsanitized, or unauthorized media reaches a public surface.
