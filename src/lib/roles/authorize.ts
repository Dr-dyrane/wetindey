/**
 * ADR-022 P1 deny-by-default authorization resolver.
 *
 * Pure and import-safe: no I/O, no server-only, no live caller anywhere in
 * the app (P1 owns no UI, verification decision, contact publication, badge,
 * or rollout; ADR-022 line 257). The resolver decides one question: may this
 * subject exercise this permission over this exact scope right now, given the
 * CURRENT assignment record.
 *
 * Fail-closed contract (ADR-022 lines 82-84): unknown roles, permissions,
 * subjects, states, or environments deny; malformed input denies; a scope
 * mismatch on either axis denies. Allow requires every check to pass; there
 * is no allow-by-omission path.
 *
 * Session claims are a CACHE, never the authority (ADR-022 lines 84-86):
 * "Short-lived session claims may be a cache, never the authority after
 * suspension or revocation." Every entry point here takes the current
 * assignment record; `authorizeDefeatingStaleClaim` exists so call sites that
 * hold a cached session claim structurally cannot use it as the authority.
 */

import {
  ASSIGNMENT_LIFECYCLE_STATES,
  KNOWN_ENVIRONMENTS,
  PERMISSIONS,
  ROLE_TEMPLATES,
  TEMPLATE_PERMISSION_CEILING,
  type AssignmentLifecycleState,
  type AuthorizationRequest,
  type Permission,
  type RoleScope,
  type RoleTemplate,
} from "./types";

/**
 * Every way the resolver can deny, as a finite reason vocabulary. Reasons are
 * safe to log and audit: they carry no subject, scope, or evidence value.
 */
export const DENY_REASONS = [
  "malformed_input",
  "unknown_environment",
  "unknown_permission",
  "unknown_role_template",
  "unknown_lifecycle_state",
  "subject_mismatch",
  "assignment_not_active",
  "outside_effective_window",
  "cross_business_scope",
  "cross_place_scope",
  "permission_not_enumerated",
  "permission_outside_template",
] as const;

export type DenyReason = (typeof DENY_REASONS)[number];

export type AuthorizationDecision =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: DenyReason };

function deny(reason: DenyReason): AuthorizationDecision {
  return { allow: false, reason };
}

const ALLOW: AuthorizationDecision = { allow: true };

/**
 * A usable reference: a non-empty, non-whitespace string with no wildcard
 * character. There is no wildcard scope (ADR-022 line 114); a literal "*"
 * anywhere in a reference is malformed, not a match-all.
 */
function isRef(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.includes("*")
  );
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Reads the two scope refs EXACTLY ONCE into a fresh object, then validates
 * the copies. Validating live properties and copying on a second read let a
 * mutating getter show validation one value and comparison another; parsing
 * into locals first makes the checked value and the compared value the same
 * bytes by construction.
 */
function parseScope(value: unknown): RoleScope | null {
  if (typeof value !== "object" || value === null) return null;
  const scope = value as Record<string, unknown>;
  const businessRef = scope.businessRef;
  const placeRef = scope.placeRef;
  if (!isRef(businessRef) || !isRef(placeRef)) return null;
  return { businessRef, placeRef };
}

function isKnownPermission(value: unknown): value is Permission {
  return (PERMISSIONS as readonly unknown[]).includes(value);
}

function isKnownTemplate(value: unknown): value is RoleTemplate {
  return (ROLE_TEMPLATES as readonly unknown[]).includes(value);
}

function isKnownLifecycleState(
  value: unknown,
): value is AssignmentLifecycleState {
  return (ASSIGNMENT_LIFECYCLE_STATES as readonly unknown[]).includes(value);
}

/**
 * Structural validation of the request half. Returns null when any field is
 * missing or malformed; the caller denies `malformed_input`.
 */
function parseRequest(value: unknown): {
  subjectRef: string;
  permission: unknown;
  scope: RoleScope;
  environment: unknown;
} | null {
  if (typeof value !== "object" || value === null) return null;
  const request = value as Record<string, unknown>;
  if (!isRef(request.subjectRef)) return null;
  const scope = parseScope(request.scope);
  if (scope === null) return null;
  if (typeof request.permission !== "string") return null;
  if (typeof request.environment !== "string") return null;
  return {
    subjectRef: request.subjectRef,
    permission: request.permission,
    scope,
    environment: request.environment,
  };
}

/**
 * Structural validation of the assignment half. Returns null when any field
 * is missing or malformed; the caller denies `malformed_input`. Template,
 * lifecycle-state, and permission VALUES are validated separately so each
 * unknown value denies with its own reason.
 */
function parseAssignment(value: unknown): {
  subjectRef: string;
  template: unknown;
  scope: RoleScope;
  permissions: readonly unknown[];
  state: unknown;
  effectiveAt: Date;
  expiresAt: Date | null;
  issuerRef: string;
  reviewerRef: string;
} | null {
  if (typeof value !== "object" || value === null) return null;
  const assignment = value as Record<string, unknown>;
  if (!isRef(assignment.subjectRef)) return null;
  if (!isRef(assignment.issuerRef)) return null;
  if (!isRef(assignment.reviewerRef)) return null;
  const scope = parseScope(assignment.scope);
  if (scope === null) return null;
  if (!Array.isArray(assignment.permissions)) return null;
  if (!isValidDate(assignment.effectiveAt)) return null;
  const expiresAt = assignment.expiresAt;
  if (expiresAt !== null && !isValidDate(expiresAt)) return null;
  if (typeof assignment.template !== "string") return null;
  if (typeof assignment.state !== "string") return null;
  return {
    subjectRef: assignment.subjectRef,
    template: assignment.template,
    scope,
    permissions: assignment.permissions,
    state: assignment.state,
    effectiveAt: assignment.effectiveAt,
    expiresAt: expiresAt as Date | null,
    issuerRef: assignment.issuerRef,
    reviewerRef: assignment.reviewerRef,
  };
}

/**
 * The resolver. Deny-by-default over the CURRENT assignment record.
 *
 * Check order is deterministic and documented so refutation can be
 * table-driven: input shape, environment, requested permission, assignment
 * template, assignment lifecycle-state value, enumerated-grant values,
 * subject identity, active state, effective window, business scope, place
 * scope, enumeration, template ceiling. The first failing check names the
 * deny reason.
 */
export function authorize(
  currentAssignment: unknown,
  request: unknown,
  now: Date,
): AuthorizationDecision {
  if (!isValidDate(now)) return deny("malformed_input");

  const parsedRequest = parseRequest(request);
  if (parsedRequest === null) return deny("malformed_input");

  if (
    !(KNOWN_ENVIRONMENTS as readonly unknown[]).includes(
      parsedRequest.environment,
    )
  ) {
    return deny("unknown_environment");
  }

  if (!isKnownPermission(parsedRequest.permission)) {
    return deny("unknown_permission");
  }

  const assignment = parseAssignment(currentAssignment);
  if (assignment === null) return deny("malformed_input");

  if (!isKnownTemplate(assignment.template)) {
    return deny("unknown_role_template");
  }

  if (!isKnownLifecycleState(assignment.state)) {
    return deny("unknown_lifecycle_state");
  }

  // An assignment carrying any grant outside the vocabulary is fail-closed
  // in full: an unknown grant is evidence of drift, not a bonus capability.
  for (const granted of assignment.permissions) {
    if (!isKnownPermission(granted)) return deny("unknown_permission");
  }

  if (assignment.subjectRef !== parsedRequest.subjectRef) {
    return deny("subject_mismatch");
  }

  // Suspension and revocation remove protected access immediately (ADR-022
  // lines 84-86, 134-136); `expired` requires re-verification (line 137).
  // Only `active` can ever allow.
  if (assignment.state !== "active") {
    return deny("assignment_not_active");
  }

  if (assignment.effectiveAt.getTime() > now.getTime()) {
    return deny("outside_effective_window");
  }
  if (
    assignment.expiresAt !== null &&
    assignment.expiresAt.getTime() <= now.getTime()
  ) {
    return deny("outside_effective_window");
  }

  // Exact scope equality on both axes. An assignment to one place or
  // business reveals nothing about another (ADR-022 line 114).
  if (assignment.scope.businessRef !== parsedRequest.scope.businessRef) {
    return deny("cross_business_scope");
  }
  if (assignment.scope.placeRef !== parsedRequest.scope.placeRef) {
    return deny("cross_place_scope");
  }

  // Only permissions explicitly enumerated on the assignment count (ADR-022
  // line 76); the template never implies a grant.
  if (!assignment.permissions.includes(parsedRequest.permission)) {
    return deny("permission_not_enumerated");
  }

  // Defence in depth: an enumerated grant outside the template's ceiling is
  // a widened scope, which the ADR forbids (line 100); deny it even though
  // it was enumerated.
  const ceiling = TEMPLATE_PERMISSION_CEILING[assignment.template];
  if (!ceiling.includes(parsedRequest.permission)) {
    return deny("permission_outside_template");
  }

  return ALLOW;
}

/**
 * The cache-defeat entry point. "Short-lived session claims may be a cache,
 * never the authority after suspension or revocation" (ADR-022 lines 84-86).
 *
 * Whatever the cached session claim asserts, this function discards it
 * unread and recomputes authorization from the CURRENT assignment record
 * alone. Call sites that hold a session claim must route through here so a
 * stale "approved" claim structurally cannot outlive a suspension or
 * revocation.
 */
export function authorizeDefeatingStaleClaim(
  staleSessionClaim: unknown,
  currentAssignment: unknown,
  request: AuthorizationRequest | unknown,
  now: Date,
): AuthorizationDecision {
  void staleSessionClaim; // deliberately discarded: cache only, never authority
  return authorize(currentAssignment, request, now);
}
