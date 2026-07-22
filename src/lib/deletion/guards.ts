/**
 * ADR-021 P1 fail-closed guards for the deletion admin-auth boundary.
 *
 * These guards decide whether the administrative adapter may touch a target at
 * all. They fail CLOSED: an absent or ambiguous target, a target missing any
 * required capability field, or any field that does not match the expected
 * target all throw rather than proceed. No guard ever logs or embeds a target
 * value, so a thrown error carries no identifying data.
 *
 * Server-only is enforced at runtime (a `window` check) rather than via the
 * `server-only` package so this boundary can be exercised by the P1 contract
 * test under Node; in a browser bundle the same check throws.
 */

import { TARGET_DESCRIPTOR_KEYS, type ResolvedTarget, type TargetDescriptor } from "./types";

export class DeletionServerOnlyError extends Error {
  constructor() {
    super("deletion admin-auth boundary is server-only and must never run in a browser");
    this.name = "DeletionServerOnlyError";
  }
}

export type DeletionTargetFailure = "ambiguous" | "missing_capability" | "mismatch";

export class DeletionTargetError extends Error {
  constructor(
    readonly reason: DeletionTargetFailure,
    message: string,
  ) {
    super(message);
    this.name = "DeletionTargetError";
  }
}

/** Throws in any browser/client context; a no-op on the server. */
export function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new DeletionServerOnlyError();
  }
}

/**
 * Proves the resolved target matches the expected target exactly, or throws.
 * Fail-closed order: an absent/non-object response is `ambiguous`; a missing or
 * empty required field is `missing_capability`; any differing field is a
 * `mismatch`. Only the offending key name is reported, never a value.
 */
export function assertExactTarget(
  expected: TargetDescriptor,
  actual: ResolvedTarget,
): asserts actual is TargetDescriptor {
  if (actual === null || actual === undefined || typeof actual !== "object") {
    throw new DeletionTargetError(
      "ambiguous",
      "resolved deletion target is absent or ambiguous",
    );
  }
  const observed = actual as Partial<Record<keyof TargetDescriptor, unknown>>;
  for (const key of TARGET_DESCRIPTOR_KEYS) {
    const value = observed[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new DeletionTargetError(
        "missing_capability",
        `resolved deletion target is missing required capability '${key}'`,
      );
    }
    if (value !== expected[key]) {
      throw new DeletionTargetError(
        "mismatch",
        `resolved deletion target '${key}' does not match the expected target`,
      );
    }
  }
}

/** Non-throwing form for callers that want a boolean rather than a fail-closed throw. */
export function matchesExactTarget(
  expected: TargetDescriptor,
  actual: ResolvedTarget,
): actual is TargetDescriptor {
  try {
    assertExactTarget(expected, actual);
    return true;
  } catch {
    return false;
  }
}
