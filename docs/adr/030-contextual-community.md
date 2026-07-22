# ADR-030: Contextual community is anchored, typed, fail-closed, and never factual truth

**Status:** Proposed
**Date:** 2026-07-22
**Decision owner:** Founder
**Scope:** What a community post is, its anchoring and typing, its admission through the
ADR-019 pending and moderation boundary, identity/abuse/duplicate controls, privacy,
retention, and its hard separation from live factual price and availability truth

> This ADR proposes the policy the contextual community model must obey. Proposing it
> mutates no shared database and enables no public projection: it authorizes no lane,
> schema, migration, table, storage, application code, or deployment. Community discussion
> stays fail-closed behind moderation exactly as ADR-019 requires, and reviews, ratings,
> feeds, reputation, and social distribution remain parked under WD-P-002.

## Context

Portfolio entry WD-P-002 ("Yelp-like reviews and community launch") is parked, and its
scope examples deliberately fold several different products into one line: "Ratings,
reviews, replies, media, helpful votes, feeds, recommendations, and community discussion."
The Founder has released only the last of these, community discussion, and only in a
specific shape: contextual discussion anchored to a product, a seller, or a market.
Everything else in WD-P-002 stays parked.

That release needs an explicit boundary, because a community layer is the easiest surface
on which WetinDey's truth guarantees could quietly leak. A post can read like a live price,
a stream of posts can drift into a social feed, popular posts can imitate reputation, and a
targeted post can become harassment. This ADR draws the boundary so discussion can exist
without becoming any of those things.

Adjacent decisions bound this one.

- [ADR-019](019-contribution-integrity-and-moderation.md) makes public contribution flow
  through a transactional, idempotent, rate-enforced, fail-closed pending boundary, and
  moderation is the only path from a submission to a public projection.
- [ADR-011](011-earned-trust-graph-and-reputation.md) keeps subjective evaluation separate
  from factual current-state claims, keeps reputation earned from independently validated
  outcomes rather than popularity, and does not launch reputation;
  [ADR-009](009-polymorphic-ratings-and-reviews.md)'s review schema stays quarantined.
- [ADR-013](013-public-source-ingestion-boundary.md) governs external content through a
  separate staging and review firewall, so a contributor's own post is not third-party
  ingestion and third-party text is not a community post.
- [ADR-015](015-observation-provenance-admissibility.md) keeps confidence earned only from
  admissible `observed` evidence, so discussion can never manufacture confidence or
  corroboration.
- [ADR-003](003-identity-for-contribution-trust.md) keeps browsing anonymous and permits
  anonymous contribution; authentication is recognition, not a publication bypass.
- [ADR-021](021-account-deletion-lifecycle.md) removes a user's data through an ordered
  saga, and [ADR-023](023-browsing-context-and-device-location.md) governs location
  disclosure.
- [ADR-028](028-contribution-evidence-media.md) governs contributor media as optional,
  sanitized, moderated, and fail-closed; this ADR introduces no media of its own.

## Decision

WetinDey proposes a contextual community: typed, anchored discussion attached to one
specific product, seller, or market, admitted through the same fail-closed pending and
moderation boundary as an ADR-019 contribution and never able to become live factual truth.
A community post is discussion, never a claim, never a review, never a rating, and never
evidence.

It is explicitly not a social feed, not Yelp-style reviews, not ratings, not reputation,
not a follower graph, and not direct messaging.

The following invariants are proposed as consistent with ADR-019, ADR-011, ADR-013,
ADR-015, ADR-021, and ADR-023.

## Invariants

### 1. A community post is anchored, typed, and subjective, never a claim

Every community post references exactly one anchor: one product/item, one seller, or one
market/place that already exists in WetinDey. There is no un-anchored, global, or
profile-level post, because an un-anchored post is a feed, not context.

A post is typed by discussion intent, for example a question, a tip, a heads-up about an
experience, or a reply to another post on the same anchor. It is subjective discussion. It
carries no availability state, no price amount, kind, or range, no unit, and no observation
time; those fields belong exclusively to the ADR-019 typed observation payload and never to
a post.

A post is never a rating or a review: it has no star, score, numeric grade, aggregate, or
ranking value, and it produces none. Text that reads like a factual assertion inside a post
(for example "rice is 85k at that stall") stays discussion only and sets nothing.

### 2. Posts enter the same fail-closed pending and moderation boundary

A community post is admitted exactly like an ADR-019 contribution: one transactional,
idempotent, rate-enforced admission creates one immutable pending post, and the post is not
publicly visible until an authorized moderation decision approves it. Acceptance means
received for review, never published, endorsed, or verified.

Admission and moderation are append-only. A correction or reply is a new linked post, not an
in-place edit; a moderation outcome is a separate append-only decision with actor,
timestamp, reason code, and request ID; a reversal is a new decision referencing the prior
one. Pending, rejected, superseded, expired, hidden, or otherwise inadmissible posts are not
publicly visible and cannot influence any public surface.

Fail-closed is the default: any failure to durably admit, moderate, or authorize leaves
nothing public.

### 3. A post never becomes live factual price, availability, confidence, verification, or reputation

This is the hard separation. A community post, approved or not, can never:

- create, set, change, or blank an availability or price projection, `offers_current`, the
  map, search, or any current-state result;
- count as `observed` evidence under ADR-015, as independent corroboration under ADR-019
  invariant 7, or as an input to confidence or freshness;
- create identity verification, a verification assertion, earned recognition, or any
  reputation under ADR-011; or
- be auto-extracted, parsed, summarized, or mined into evidence.

The only path for a fact discussed in the community to become live truth is a separate,
typed ADR-019 report that passes observation admissibility on its own merits. The community
layer must not read a post and manufacture a claim from it, the same prohibition ADR-013
places on external content and [ADR-027](027-ai-routed-general-search.md) places on model
output.

### 4. Identity, abuse, and duplicate controls match the contribution boundary

Anonymous contribution is permitted under ADR-003; authentication is recognition, not a
publication, rate, or moderation bypass. A signed-in author is still pending and still
rate-limited; an anonymous author is admitted through a data-minimized contribution/session
subject that is not presented as a known person and is not reputation.

Duplicate and abuse controls are the ADR-019 controls: a client idempotency key with a
normalized digest so retries create exactly one post; durable server-side rate limits per
data-minimized subject, anchor, and operation so an anchor cannot be flooded; and
fail-closed moderation for harassment, targeting, impersonation, spam, illegal, or
off-anchor content. Posting is per-anchor and rate-bounded; there is no bulk or automated
posting path.

### 5. Privacy: minimal identity, disclosed location, least-privilege access

A public post exposes only approved attribution. Public responses never expose email, raw
network identifiers, precise contributor location, internal risk or moderation signals,
private or pending or rejected posts, or moderator notes. Pending and rejected content and
moderation context are reachable only by separately authorized, least-privileged
moderation, exactly as ADR-019 requires.

A post's text or any attachment can never become an undisclosed location or identity signal
outside ADR-023. This ADR introduces no media; if a post is ever allowed to carry a photo,
that photo is governed by ADR-028's sanitization, moderation, and retention with no
exception, and it remains out of scope until separately decided.

### 6. Retention is bounded and tied to the anchor and lifecycle

Community content persists only as long as justified, and never as an evidentiary record:

- pending posts are retained only while awaiting moderation and expire under a bounded
  pending window rather than persisting indefinitely;
- approved posts are retained while their anchor exists and the post remains admissible, and
  are removed or hidden when the anchor is removed, the post is superseded, or its approval
  is reversed;
- rejected posts are purged under a bounded short retention, keeping only the minimal
  non-content audit reference needed to reconstruct that a submission and its decision
  occurred; and
- account deletion removes a user's community posts and redacts their attribution through
  the existing ADR-021 saga, enumerating and removing the account's post content by its
  deterministic scope and treating "already absent" as idempotent success only after
  enumeration proves nothing remains.

Deleting or expiring community content removes discussion only. It never rewrites,
fabricates, or resurfaces a factual claim, because a post was never a claim.

## Consequences

**Improves.** People can ask and share context on a specific product, seller, or market
without WetinDey pretending discussion is truth. Discussion is anchored, moderated,
retention-bounded, deletion-enumerable, and firmly separated from price, availability,
confidence, and reputation.

**Costs.** Community adds a pending and moderation surface for text, rate and duplicate
controls, privacy review, an added ADR-021 cleanup phase, retention and expiry jobs, and
adversarial testing of admission, moderation, deletion, and the truth separation.
Publication is slower because posts are admitted separately from approval.

**Constrains.** No post may auto-publish, become evidence, set a projection, or create
reputation; no un-anchored, feed, or profile-level post exists; no reviews, ratings,
follower graph, or direct messaging is introduced; and no factual claim is ever
auto-extracted from discussion.

## Non-goals

This ADR does not:

- create a social feed, home timeline, ranked discovery stream, or any un-anchored post
  surface;
- create a follower, friend, or subscribe graph, or any social distribution of posts;
- create reviews, ratings, stars, scores, aggregates, helpful votes, or recommendations,
  which stay parked under WD-P-002 and quarantined under ADR-009;
- create reputation, earned recognition, or verification from posting activity, which remain
  governed by ADR-011;
- create direct messages, private inboxes, or any user-to-user private channel;
- add likes or reactions used for ranking, or any paid boost or seller placement of posts;
- introduce media; a community photo, if ever allowed, is governed by ADR-028 and is out of
  scope here;
- ingest third-party, web, partner, or public-source content into the community, which
  remains governed by ADR-013;
- let a post create, modify, or corroborate any factual price, availability, confidence,
  freshness, or verification result; or
- authorize a lane, schema, migration, table, storage, application code, deployment, or
  rollout, or access or provision any database or storage.

## Validation and review

This ADR remains Proposed until the Founder accepts the boundary. The later implementation
defaults to **REFUTED** unless independent evidence proves all of the following:

- every post is anchored to exactly one existing product, seller, or market, and no
  un-anchored or feed surface exists;
- a post carries no availability, price, unit, or observation-time field and produces no
  rating, score, or ranking value;
- a submitted post is pending and invisible until an authorized moderation decision, and
  pending, rejected, superseded, and expired posts never appear publicly;
- same-key retries create exactly one post, and durable per-subject and per-anchor rate
  limits prevent flooding;
- a signed-out author reaches the same pending, idempotent, rate-limited moderation boundary
  through a data-minimized subject, and signing in grants no publication or moderation
  bypass;
- no post changes `offers_current`, the map, search, availability, price, confidence, or
  freshness, and no post is auto-extracted into evidence or corroboration;
- no post creates verification, earned recognition, or reputation;
- account deletion enumerates and removes the account's posts through the ADR-021 saga while
  preserving the minimal moderation audit reference; and
- public responses leak no identity beyond approved attribution, no precise location, and no
  pending, rejected, or moderation-private content.

Review this ADR before the first community schema or storage is claimed, before any post
admission path is enabled, before any post reaches a public surface, after any change to the
ADR-019 pending or moderation boundary, after any change to ADR-011 reputation scope, after
any change to ADR-021 deletion ordering or ADR-023 location disclosure, and after any
integrity or privacy event in which a post reaches a public surface unmoderated, a
discussion claim reaches a factual projection, or private content is exposed.
