/**
 * ADR-022 P1 role-authorization vocabulary (single source of truth).
 *
 * This module is pure: only `const` label tuples, union types derived from
 * them, and plain data-shape interfaces. It imports nothing at all, so it can
 * never carry a side effect into any consumer, and the future schema half of
 * P1 (blocked on two controller rulings; see LANES.md) can cross-check its
 * pgEnums against these exact tuples the way the deletion P1 contract
 * cross-checks src/lib/deletion/types.ts against src/db/schema/deletion.ts.
 *
 * Boundary of record: the initial family is the three seller templates and
 * nothing else. The ADR names later operator families (its lines 103-111),
 * but "none exists merely because it is named here"; this module must not
 * declare them, and the P1 contract asserts their absence. The shipped
 * contribution moderation machinery (contribution_moderator_assignments and
 * contribution_assert_moderator) remains the sole moderation truth; nothing
 * here duplicates or competes with it.
 */

/**
 * The initial role family, exactly the ADR-022 matrix rows (lines 97-101).
 * No role is an identity, trust, or status shortcut (ADR-022 lines 28-32).
 */
export const ROLE_TEMPLATES = [
  "seller_owner",
  "seller_manager",
  "seller_staff",
] as const;

export type RoleTemplate = (typeof ROLE_TEMPLATES)[number];

/**
 * Assignment lifecycle states. Mirrors the shipped
 * `contribution_assignment_status` enum (active/suspended/revoked) plus
 * `expired`, which ADR-022 line 52 names as a first-class lifecycle state and
 * line 137 gives distinct semantics: expiry requires re-verification rather
 * than silent renewal.
 */
export const ASSIGNMENT_LIFECYCLE_STATES = [
  "active",
  "suspended",
  "revoked",
  "expired",
] as const;

export type AssignmentLifecycleState =
  (typeof ASSIGNMENT_LIFECYCLE_STATES)[number];

/**
 * The eight canonical claim states, exactly ADR-022 lines 124-126:
 * draft -> pending -> needs_info -> approved, rejected, suspended, revoked,
 * or expired. The legal edges between them live in ./lifecycle.ts.
 */
export const CLAIM_STATES = [
  "draft",
  "pending",
  "needs_info",
  "approved",
  "rejected",
  "suspended",
  "revoked",
  "expired",
] as const;

export type ClaimState = (typeof CLAIM_STATES)[number];

/**
 * The enumerated permission vocabulary, derived from the ADR-022 permitted
 * direction matrix and from the separately enumerated publication permission.
 * Each name cites the ADR line that grants it. Deliberately absent, because
 * the ADR forbids or defers them: any transfer-of-control permission (line 99:
 * "cannot transfer control without re-verification"), any fulfilment
 * authority (line 99 and ADR-001), any verification/moderation/appeal/
 * accuracy/badge decision (lines 99-101), and any scope-widening permission
 * (line 100: a manager "cannot ... widen its own scope").
 */
export const PERMISSIONS = [
  /** seller_owner: "Manage a proved place-control claim" (ADR-022 line 99). */
  "manage_place_control_claim",
  /** seller_owner: "request scoped manager/staff assignments" (ADR-022 line 99). */
  "request_scoped_assignments",
  /**
   * seller_owner "maintain permitted place facts" (ADR-022 line 99);
   * seller_manager "Maintain permitted place facts" (line 100).
   */
  "maintain_place_facts",
  /** seller_manager: "Maintain ... seller submissions" (ADR-022 line 100). */
  "maintain_seller_submissions",
  /**
   * seller_manager: "manage staff only when separately granted" (ADR-022
   * line 100). The grant IS the enumeration on the assignment; it is inside
   * the manager ceiling but never implied by the template.
   */
  "manage_staff",
  /**
   * The separately enumerated publication permission: seller_owner
   * "explicitly publish or withdraw approved contact channels" (ADR-022 line
   * 99); "Only the owner, or a manager with the separately enumerated
   * publication permission, may publish or withdraw a channel" (lines
   * 171-172). Holding it does not publish anything: publication remains a
   * separate affirmative consent action (lines 159-169), entirely out of P1.
   */
  "publish_contact_channel",
  /**
   * seller_staff: "Submit attributed price, availability, hours, and
   * correction claims for assigned places and capabilities" (ADR-022 line
   * 101).
   */
  "submit_attributed_claims",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * The permission CEILING per template: the largest set an assignment of that
 * template may enumerate. It is a ceiling, never a default grant; the
 * resolver honors only permissions explicitly enumerated on the assignment
 * (ADR-022 line 76: "an enumerated permission set"), and denies any
 * enumerated permission outside the template's ceiling. Rows follow the
 * ADR-022 matrix exactly (lines 99-101).
 */
export const TEMPLATE_PERMISSION_CEILING: Readonly<
  Record<RoleTemplate, readonly Permission[]>
> = {
  seller_owner: [
    "manage_place_control_claim",
    "request_scoped_assignments",
    "maintain_place_facts",
    "publish_contact_channel",
  ],
  seller_manager: [
    "maintain_place_facts",
    "maintain_seller_submissions",
    "manage_staff",
    "publish_contact_channel",
  ],
  seller_staff: ["submit_attributed_claims"],
};

/**
 * The environments authorization may run in. ADR-022 line 83 requires the
 * resolver to fail closed for unknown environments; anything not in this
 * tuple denies.
 */
export const KNOWN_ENVIRONMENTS = [
  "development",
  "preview",
  "production",
] as const;

export type KnownEnvironment = (typeof KNOWN_ENVIRONMENTS)[number];

/**
 * An explicit scope: one business reference and one place reference, both
 * required. There is no wildcard scope and no account-wide scope: "An
 * assignment to one place or business reveals nothing about another"
 * (ADR-022 line 114) and approval "never records a vague account-wide
 * 'verified seller' truth" (lines 131-132).
 */
export interface RoleScope {
  readonly businessRef: string;
  readonly placeRef: string;
}

/**
 * The data shape of one role assignment, per ADR-022 lines 72-80: one
 * internal subject reference, a named role template, an explicit scope, an
 * enumerated permission set, lifecycle state with effective/expiry times, and
 * issuer plus independent reviewer references.
 */
export interface RoleAssignmentRecord {
  readonly subjectRef: string;
  readonly template: RoleTemplate;
  readonly scope: RoleScope;
  readonly permissions: readonly Permission[];
  readonly state: AssignmentLifecycleState;
  readonly effectiveAt: Date;
  readonly expiresAt: Date | null;
  readonly issuerRef: string;
  readonly reviewerRef: string;
}

/**
 * What a protected read or mutation asks the resolver: which subject wants
 * which permission over which exact scope, in which environment. Server-side
 * authorization resolves this on EVERY protected mutation and sensitive read
 * (ADR-022 lines 82-84); there is no ambient or inherited request shape.
 */
export interface AuthorizationRequest {
  readonly subjectRef: string;
  readonly permission: Permission;
  readonly scope: RoleScope;
  readonly environment: KnownEnvironment;
}
