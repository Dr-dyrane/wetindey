/**
 * ADR-021 P1 administrative Auth adapter boundary (INERT).
 *
 * This is the server-only boundary that a later phase will use to delete an
 * authenticated identity on a Neon branch. In P1 it is deliberately inert: it
 * proves it is aimed at the exact expected project/branch/environment and FAILS
 * CLOSED on any mismatch, missing capability, or ambiguous response, and then it
 * refuses to perform any real destructive call. Preview and Production are
 * separate targets, each with its own adapter instance. The injected provider is
 * held for later phases and is NEVER invoked in P1, so no real account is ever
 * deleted against any real identity.
 */

import { assertExactTarget, assertServerOnly } from "./guards";
import type { DeletionEnvironment, ResolvedTarget, TargetDescriptor } from "./types";

export class DeletionAdapterInertError extends Error {
  constructor(readonly environment: DeletionEnvironment) {
    super(
      `deletion admin-auth adapter is inert in P1 (${environment}); no destructive provider call is performed`,
    );
    this.name = "DeletionAdapterInertError";
  }
}

export class DeletionAdapterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeletionAdapterConfigError";
  }
}

/**
 * The identity provider a later phase would drive. In P1 the adapter never calls
 * any of its methods; it exists so the boundary's later shape is fixed now.
 */
export interface AuthDeletionProvider {
  deleteIdentity(identityRef: string): Promise<void>;
}

export interface AdminAuthAdapterConfig {
  readonly environment: DeletionEnvironment;
  readonly expected: TargetDescriptor;
  readonly provider?: AuthDeletionProvider;
}

/**
 * A single-target administrative Auth adapter. Construct one per environment;
 * the expected descriptor's environment must equal the adapter's environment or
 * construction fails closed.
 */
export class AdminAuthAdapter {
  readonly environment: DeletionEnvironment;
  private readonly expected: TargetDescriptor;
  private readonly provider: AuthDeletionProvider | null;

  constructor(config: AdminAuthAdapterConfig) {
    if (config.expected.environment !== config.environment) {
      throw new DeletionAdapterConfigError(
        "adapter environment does not match its expected target environment",
      );
    }
    this.environment = config.environment;
    this.expected = config.expected;
    this.provider = config.provider ?? null;
  }

  /** True once a provider is wired; P1 still never calls it. */
  hasProvider(): boolean {
    return this.provider !== null;
  }

  /**
   * Proves server-only execution and an exact target match. Fails closed on any
   * ambiguity, missing capability, or mismatch. Narrows `actual` to a full
   * `TargetDescriptor` on success.
   */
  assertReady(actual: ResolvedTarget): asserts actual is TargetDescriptor {
    assertServerOnly();
    assertExactTarget(this.expected, actual);
  }

  /** Non-throwing readiness probe. */
  isReady(actual: ResolvedTarget): boolean {
    try {
      this.assertReady(actual);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * P1 destructive entry point. It first proves the target (throwing before any
   * provider access on a mismatch), then, because P1 is inert, throws
   * `DeletionAdapterInertError` without ever touching the provider. This method
   * can therefore never delete a real identity.
   */
  async deleteAuthIdentity(actual: ResolvedTarget, _identityRef: string): Promise<never> {
    this.assertReady(actual);
    throw new DeletionAdapterInertError(this.environment);
  }
}
