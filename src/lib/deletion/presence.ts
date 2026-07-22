/**
 * ADR-021 P2 Presence account-deletion adapter (INERT).
 *
 * Encodes the idempotent invocation of the accepted Presence boundary
 * `public.presence_delete_account(p_actor, p_session_digest, p_device_digest,
 * p_network_digest)` and proves its result. That boundary is a SECURITY DEFINER
 * function reached over a separate Presence-safety principal; live invocation is
 * a later integration concern. Here the adapter only ENCODES the call and drives
 * an INJECTED boundary (a disposable fixture in tests, a scoped connection in a
 * later live phase). It imports no real database client, so no shared Presence
 * database is ever contacted; with nothing wired it throws
 * `DeletionNotWiredError`.
 *
 * The boundary itself deletes the account's leases, preferences, blocks, and
 * rate buckets and PSEUDONYMISES its safety reports (reporter/subject rewritten
 * to an erasure UUID, details nulled). This adapter's proof asserts the mirror
 * of that: after invocation nothing attributable to the actor remains EXCEPT the
 * retained, tombstoned safety reports, which are the only approved minimal
 * Presence metadata that survives an erasure.
 */

import { assertServerOnly } from "./guards";
import { DeletionNotWiredError, assertDeletionSubjectId } from "./cleanup";

/** Presence digests are the same lowercase 64-hex sha256 the boundary asserts. */
const PRESENCE_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export class PresenceDigestError extends Error {
  constructor(readonly label: string) {
    super(`presence ${label} must be null or a lowercase 64-hex sha256 digest`);
    this.name = "PresenceDigestError";
  }
}

export function assertPresenceDigest(label: string, value: string | null): void {
  if (value !== null && !PRESENCE_DIGEST_PATTERN.test(value)) {
    throw new PresenceDigestError(label);
  }
}

/** The fully-resolved, guarded call descriptor the boundary is invoked with. */
export interface PresenceDeleteCall {
  readonly fn: "public.presence_delete_account";
  readonly actor: string;
  readonly sessionDigest: string | null;
  readonly deviceDigest: string | null;
  readonly networkDigest: string | null;
}

export interface PresenceDeleteInput {
  readonly sessionDigest?: string | null;
  readonly deviceDigest?: string | null;
  readonly networkDigest?: string | null;
}

/**
 * Encodes the call. The actor must be the account UUID; each optional digest is
 * either null (the boundary's own default) or a 64-hex sha256. Nothing raw ever
 * reaches the call descriptor.
 */
export function buildPresenceDeleteCall(
  subjectId: string,
  input: PresenceDeleteInput = {},
): PresenceDeleteCall {
  assertDeletionSubjectId(subjectId);
  const sessionDigest = input.sessionDigest ?? null;
  const deviceDigest = input.deviceDigest ?? null;
  const networkDigest = input.networkDigest ?? null;
  assertPresenceDigest("session digest", sessionDigest);
  assertPresenceDigest("device digest", deviceDigest);
  assertPresenceDigest("network digest", networkDigest);
  return {
    fn: "public.presence_delete_account",
    actor: subjectId,
    sessionDigest,
    deviceDigest,
    networkDigest,
  };
}

/**
 * The Presence footprint observed AFTER the boundary ran. Every count except
 * `tombstonedReports` must be zero: the account leaves no live lease, no
 * preference, no block, no rate bucket, and no report still naming it.
 * `tombstonedReports` is the retained, pseudonymised safety metadata and may be
 * any non-negative number.
 */
export interface PresenceResidue {
  readonly liveLeases: number;
  readonly preferences: number;
  readonly blocks: number;
  readonly rateBuckets: number;
  readonly reportsAttributed: number;
  readonly tombstonedReports: number;
}

export interface PresenceDeletionBoundary {
  deleteAccount(call: PresenceDeleteCall): Promise<void>;
  probeResidue(actor: string): Promise<PresenceResidue>;
}

/** The residue fields that MUST be zero for a proven erasure. */
export const PRESENCE_ATTRIBUTED_FIELDS = [
  "liveLeases",
  "preferences",
  "blocks",
  "rateBuckets",
  "reportsAttributed",
] as const satisfies readonly (keyof PresenceResidue)[];

export class PresenceResidueError extends Error {
  constructor(readonly field: keyof PresenceResidue) {
    super(
      `presence account-deletion left residue attributable to the actor (${String(field)})`,
    );
    this.name = "PresenceResidueError";
  }
}

export interface PresenceCleanupResult {
  readonly invoked: true;
  readonly tombstonedReports: number;
  readonly residueClear: true;
}

export class PresenceCleanupAdapter {
  private readonly boundary: PresenceDeletionBoundary | null;

  constructor(config?: { boundary?: PresenceDeletionBoundary | null }) {
    this.boundary = config?.boundary ?? null;
  }

  isWired(): boolean {
    return this.boundary !== null;
  }

  async run(
    subjectId: string,
    input: PresenceDeleteInput = {},
  ): Promise<PresenceCleanupResult> {
    assertServerOnly();
    const call = buildPresenceDeleteCall(subjectId, input);
    if (!this.boundary) {
      throw new DeletionNotWiredError("presence-cleanup");
    }

    // Idempotent: the boundary deletes/tombstones by actor, so a second
    // invocation finds nothing left to change and still proves clear.
    await this.boundary.deleteAccount(call);

    const residue = await this.boundary.probeResidue(call.actor);
    for (const field of PRESENCE_ATTRIBUTED_FIELDS) {
      if (residue[field] !== 0) {
        throw new PresenceResidueError(field);
      }
    }

    return {
      invoked: true,
      tombstonedReports: residue.tombstonedReports,
      residueClear: true,
    };
  }
}
