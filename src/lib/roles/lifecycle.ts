/**
 * ADR-022 P1 claim-lifecycle machine, separation-of-duties guards, and the
 * compare-and-set transition primitive.
 *
 * The lifecycle machine lives in application code, NOT in a database
 * function, in the exact idiom of src/lib/deletion/phases.ts: a worker
 * advances a claim only through `transitionClaim`, which issues a
 * version-guarded compare-and-set, so two workers that both read the same
 * row version can never double-advance it. This module is pure and
 * import-safe (no server-only, no I/O), so the contract test drives it
 * directly.
 *
 * P1 boundary: these are guards and primitives with no live caller. No
 * verification decision, onboarding workflow, or UI exists here (ADR-022
 * line 257).
 */

import { type ClaimState } from "./types";

/**
 * The only legal claim-state transitions, exactly as ADR-022 draws them
 * (lines 124-137):
 *
 *   draft -> pending                       submission for review
 *   pending -> needs_info                  reviewer asks for more evidence
 *   pending -> approved | rejected         independent review decides
 *   needs_info -> pending                  claimant supplies the evidence
 *   approved -> suspended                  immediate removal of protected
 *                                          access (lines 134-135, 145-147);
 *                                          suspension takes effect at once,
 *                                          with no notice period
 *   approved -> revoked                    invalidates derived assignments in
 *                                          scope (line 136)
 *   approved -> expired                    reached its expiry or re-check date
 *
 * Everything else has NO outgoing edge here. Reinstatement out of rejected,
 * suspended, or revoked exists only through the guarded one-bounded-appeal
 * path below; deleting a UI flag is not reinstatement (ADR-022 lines
 * 147-149). `expired` is fully terminal: expiry requires re-verification as
 * a NEW claim, never silent renewal (line 137).
 */
export const CLAIM_TRANSITIONS: Readonly<
  Record<ClaimState, readonly ClaimState[]>
> = {
  draft: ["pending"],
  pending: ["needs_info", "approved", "rejected"],
  needs_info: ["pending"],
  approved: ["suspended", "revoked", "expired"],
  rejected: [],
  suspended: [],
  revoked: [],
  expired: [],
};

export class RoleClaimTransitionError extends Error {
  constructor(
    readonly from: ClaimState,
    readonly to: ClaimState,
  ) {
    super(`illegal role claim transition: ${from} -> ${to}`);
    this.name = "RoleClaimTransitionError";
  }
}

export function isLegalClaimTransition(
  from: ClaimState,
  to: ClaimState,
): boolean {
  return CLAIM_TRANSITIONS[from].includes(to);
}

export function assertLegalClaimTransition(
  from: ClaimState,
  to: ClaimState,
): void {
  if (!isLegalClaimTransition(from, to)) {
    throw new RoleClaimTransitionError(from, to);
  }
}

/* ------------------------------------------------------------------------ */
/* Separation of duties                                                     */
/* ------------------------------------------------------------------------ */

export class RoleSeparationOfDutiesError extends Error {
  constructor(readonly rule: string) {
    super(`separation of duties violated: ${rule}`);
    this.name = "RoleSeparationOfDutiesError";
  }
}

/**
 * Assignment-issuance separation: subject, issuer, and reviewer must be
 * three distinct actors, mirroring the shipped
 * `contribution_moderator_assignments_separation_check` and ADR-022 lines
 * 78-79 (issuer and independent reviewer where required).
 */
export function assertAssignmentSeparation(input: {
  subjectRef: string;
  issuerRef: string;
  reviewerRef: string;
}): void {
  if (input.subjectRef === input.issuerRef) {
    throw new RoleSeparationOfDutiesError("subject must not be the issuer");
  }
  if (input.subjectRef === input.reviewerRef) {
    throw new RoleSeparationOfDutiesError("subject must not be the reviewer");
  }
  if (input.issuerRef === input.reviewerRef) {
    throw new RoleSeparationOfDutiesError("issuer must not be the reviewer");
  }
}

/**
 * Claim-approval separation: "Approval requires a reviewer who is not the
 * claimant" (ADR-022 line 128). The owner cannot approve the owner's own
 * verification (line 99).
 */
export function assertIndependentReviewer(input: {
  claimantRef: string;
  reviewerRef: string;
}): void {
  if (input.claimantRef === input.reviewerRef) {
    throw new RoleSeparationOfDutiesError(
      "claimant must not review their own claim",
    );
  }
}

/* ------------------------------------------------------------------------ */
/* One bounded appeal                                                       */
/* ------------------------------------------------------------------------ */

/**
 * The states an appeal can lift a claim out of. A successful appeal lands on
 * `approved`; an upheld decision is a no-op, not a transition.
 */
export const APPEALABLE_STATES = [
  "rejected",
  "suspended",
  "revoked",
] as const satisfies readonly ClaimState[];

/**
 * The only authority marker that may decide an appeal. ADR-022 lines
 * 141-144: an appeal is reviewed by someone other than the original
 * decision-maker and the claimant, and the assistance/helpdesk function can
 * never decide it. Deny-by-default makes that structural: any decider whose
 * authority is not exactly this marker is refused, so no seller template and
 * none of the ADR's later operator families (lines 103-111) can decide an
 * appeal through this guard.
 */
export const APPEAL_DECIDER_AUTHORITY = "independent_reviewer" as const;

export type AppealDenyReason =
  | "state_not_appealable"
  | "appeal_already_used"
  | "decider_is_original_decision_maker"
  | "decider_is_claimant"
  | "decider_authority_not_independent";

export class RoleAppealError extends Error {
  constructor(readonly reason: AppealDenyReason) {
    super(`appeal refused: ${reason}`);
    this.name = "RoleAppealError";
  }
}

/**
 * The one-bounded-appeal guard (ADR-022 lines 141-144): a claimant can
 * submit ONE appeal with new evidence; it is decided by someone who is
 * neither the original decision-maker nor the claimant, holding the
 * independent-reviewer authority and nothing else.
 */
export function assertAppealAllowed(input: {
  fromState: ClaimState;
  appealAlreadyUsed: boolean;
  deciderRef: string;
  originalDeciderRef: string;
  claimantRef: string;
  deciderAuthority: string;
}): void {
  if (
    !(APPEALABLE_STATES as readonly ClaimState[]).includes(input.fromState)
  ) {
    throw new RoleAppealError("state_not_appealable");
  }
  if (input.appealAlreadyUsed) {
    throw new RoleAppealError("appeal_already_used");
  }
  if (input.deciderRef === input.originalDeciderRef) {
    throw new RoleAppealError("decider_is_original_decision_maker");
  }
  if (input.deciderRef === input.claimantRef) {
    throw new RoleAppealError("decider_is_claimant");
  }
  if (input.deciderAuthority !== APPEAL_DECIDER_AUTHORITY) {
    throw new RoleAppealError("decider_authority_not_independent");
  }
}

/* ------------------------------------------------------------------------ */
/* Compare-and-set transition primitive                                     */
/* ------------------------------------------------------------------------ */

/** The fields a claim transition writes. `version` is bumped by the store. */
export interface RoleClaimPatch {
  readonly state: ClaimState;
  /** Present ONLY on an appeal patch; ordinary transitions omit it so the
      stored value survives and the one bounded appeal stays consumed. */
  readonly appealUsed?: true;
}

/**
 * The compare-and-set store the primitive drives. An implementation MUST
 * apply the patch atomically only when the stored `version` still equals
 * `expectedVersion`, bumping the version on success, and return whether it
 * applied. The P1 contract drives it with an in-memory fake; the schema half
 * of P1 will supply the SQL implementation.
 */
export interface RoleClaimCasStore {
  compareAndSwap(input: {
    claimRef: string;
    expectedVersion: number;
    patch: RoleClaimPatch;
  }): Promise<boolean>;
}

export interface ClaimTransitionResult {
  readonly applied: boolean;
  readonly from: ClaimState;
  readonly to: ClaimState;
  readonly expectedVersion: number;
  readonly patch: RoleClaimPatch;
}

/**
 * The CAS claim-transition primitive, in the deletion phases idiom.
 * Validates the edge, then asks the store to swap states only if the row is
 * still at `expectedVersion`. Returns `applied: false` when another worker
 * won the race; never throws on a losing race (only on an illegal edge).
 */
export async function transitionClaim(
  store: RoleClaimCasStore,
  params: {
    claimRef: string;
    expectedVersion: number;
    from: ClaimState;
    to: ClaimState;
  },
): Promise<ClaimTransitionResult> {
  assertLegalClaimTransition(params.from, params.to);
  // Ordinary transitions never carry appealUsed: only appealClaim may set it,
  // and a patch that defaulted it to false erased the one-bounded-appeal
  // invariant (a post-appeal suspension would re-arm the appeal). The state
  // field alone is this patch; the stored appealUsed survives untouched.
  const patch: RoleClaimPatch = { state: params.to };
  const applied = await store.compareAndSwap({
    claimRef: params.claimRef,
    expectedVersion: params.expectedVersion,
    patch,
  });
  return {
    applied,
    from: params.from,
    to: params.to,
    expectedVersion: params.expectedVersion,
    patch,
  };
}

/**
 * The guarded appeal transition: runs the one-bounded-appeal guard, then
 * compare-and-sets the claim to `approved` with the appeal consumed. This is
 * the ONLY path out of rejected, suspended, or revoked; restoring access
 * requires explicit review, and deleting a UI flag is not reinstatement
 * (ADR-022 lines 147-149).
 */
export async function appealClaim(
  store: RoleClaimCasStore,
  params: {
    claimRef: string;
    expectedVersion: number;
    fromState: ClaimState;
    appealAlreadyUsed: boolean;
    deciderRef: string;
    originalDeciderRef: string;
    claimantRef: string;
    deciderAuthority: string;
  },
): Promise<ClaimTransitionResult> {
  assertAppealAllowed(params);
  const patch: RoleClaimPatch = { state: "approved", appealUsed: true };
  const applied = await store.compareAndSwap({
    claimRef: params.claimRef,
    expectedVersion: params.expectedVersion,
    patch,
  });
  return {
    applied,
    from: params.fromState,
    to: "approved",
    expectedVersion: params.expectedVersion,
    patch,
  };
}
