/**
 * Coverage state: the user-facing honesty contract for a single RESULT.
 *
 * This module is INERT. It is types plus one pure classifier over an
 * admissible-evidence summary. It performs no I/O, imports nothing from the app
 * runtime, and is not wired into any read path. Wiring a coverage state into
 * results, copy, ranking, or the map is a separate later lane; this file only
 * encodes the states so that lane has one authority to call.
 *
 * The contract this file implements is docs/operations/COVERAGE-HONESTY-CONTRACT.md,
 * register entry WD-I-005 (Coverage honesty). It stays consistent with:
 *   - ADR-006 freshness windows (fresh <= 24h, stale <= 72h, expired > 72h);
 *   - ADR-012 provenance boundary (only classified origins are evidence);
 *   - ADR-015 admissibility (only `observed` + moderation-approved rows may
 *     carry current-state confidence; synthetic, partner, reference, and
 *     inferred contribute zero).
 *
 * Governing principle: hiding a gap is worse than showing no answer. Every
 * ambiguous, malformed, or under-evidenced input resolves to the least
 * confident honest state, never to a confident one. The fail-closed default is
 * `unknown`.
 *
 * IMPORTANT: A coverage state answers "do we know the current local state of
 * this subject", not "what is that state". It is orthogonal to availability. A
 * `sufficient` result can carry either in-stock or out-of-stock; coverage never
 * asserts the availability value, only whether admissible evidence supports one.
 */

/**
 * The six coverage states a RESULT can carry, per WD-I-005 and this file's
 * contract. Exactly one applies to a subject at read time.
 */
export type CoverageState =
  | "sufficient"
  | "weak"
  | "stale"
  | "conflicting"
  | "absent"
  | "unknown";

/**
 * The freshness windows that separate fresh, stale, and expired evidence.
 *
 * ADR-006 fixes these at 24h (stale boundary) and 72h (expiration boundary),
 * flat across all categories. The app's single source of truth is
 * `FRESHNESS_POLICY` in `src/lib/trust.ts`. This inert module does not import
 * app runtime, so the wiring lane must pass the live policy in; the exported
 * default below mirrors ADR-006 only so this file is self-contained and
 * testable. If ADR-006 or `FRESHNESS_POLICY` changes, both move together.
 */
export interface CoverageWindows {
  /** Fresh boundary in hours. Age at or below this is fresh. ADR-006: 24. */
  readonly staleHours: number;
  /** Expiration boundary in hours. Age above this is expired. ADR-006: 72. */
  readonly expirationHours: number;
}

/** ADR-006 windows, mirrored for a self-contained default. Not the authority. */
export const ADR006_COVERAGE_WINDOWS: CoverageWindows = {
  staleHours: 24,
  expirationHours: 72,
};

/**
 * Minimum distinct source rows in the fresh window for `sufficient` rather than
 * `weak`. Default 2 mirrors the operator packet's fresh / weak split. The exact
 * threshold is a later product decision (ADR-006 marks `TRUST_BANDS`
 * PROVISIONAL); this default changes no shipped copy or ranking.
 *
 * The count is SOURCE ROWS, not people. Per ADR-003 and ADR-006, source rows
 * are today largely category rows; a multi-source cell is a lower bound on
 * independence, never proof that N people reported.
 */
export const DEFAULT_CORROBORATION_MIN_SOURCES = 2;

/**
 * A minimal, structural summary of the ADMISSIBLE evidence for one subject.
 *
 * "Admissible" means the caller has already applied the ADR-012 provenance
 * boundary and the ADR-015 matrix and moderation gate: every field below counts
 * only `observed` + moderation-approved rows. Synthetic, partner, reference, and
 * inferred rows must be excluded before building this summary; they contribute
 * zero here by construction. Producing this summary is the wiring lane's job.
 */
export interface AdmissibleEvidenceSummary {
  /**
   * Age in hours of the newest admissible observed observation for the subject,
   * or `null` when no admissible observed row has ever existed. `null` is the
   * signal for `unknown`; a finite value means the subject was observed at least
   * once and lets `absent` (expired history) be distinguished from `unknown`.
   */
  readonly newestAdmissibleAgeHours: number | null;
  /**
   * Distinct source-row count among admissible observed rows INSIDE the fresh
   * window (age <= staleHours). Drives the `sufficient` / `weak` split. Counts
   * source rows, not people (see DEFAULT_CORROBORATION_MIN_SOURCES).
   */
  readonly freshDistinctSourceCount: number;
  /**
   * True when, inside the fresh window, admissible observed rows disagree on
   * availability (both available and unavailable appear). A hard disagreement
   * that needs a human read, not a verdict. Only meaningful in the fresh window;
   * callers set it false when no fresh admissible rows exist.
   */
  readonly freshWindowHasConflict: boolean;
}

/** Options for the classifier. All optional; omit to use the ADR-006 defaults. */
export interface ClassifyCoverageOptions {
  readonly windows?: CoverageWindows;
  readonly corroborationMinSources?: number;
}

/**
 * Structural admissibility metadata per state. This encodes what each state
 * authorizes a later presentation lane to assert; it is not user copy and
 * changes no shipped string. `admitsCurrentClaim` is whether the state may back
 * a current-state answer at all; `corroborated` is whether more than one source
 * row backs it (null when the concept does not apply); `needsHumanRead` marks a
 * state that must not be collapsed into a single automatic verdict.
 */
export interface CoverageStateMeta {
  readonly state: CoverageState;
  readonly admitsCurrentClaim: boolean;
  readonly corroborated: boolean | null;
  readonly needsHumanRead: boolean;
}

/** Frozen per-state admissibility record. Exhaustive over CoverageState. */
export const COVERAGE_STATE_META: Readonly<Record<CoverageState, CoverageStateMeta>> = {
  sufficient: {
    state: "sufficient",
    admitsCurrentClaim: true,
    corroborated: true,
    needsHumanRead: false,
  },
  weak: {
    state: "weak",
    admitsCurrentClaim: true,
    corroborated: false,
    needsHumanRead: false,
  },
  stale: {
    state: "stale",
    admitsCurrentClaim: false,
    corroborated: null,
    needsHumanRead: false,
  },
  conflicting: {
    state: "conflicting",
    admitsCurrentClaim: false,
    corroborated: null,
    needsHumanRead: true,
  },
  absent: {
    state: "absent",
    admitsCurrentClaim: false,
    corroborated: null,
    needsHumanRead: false,
  },
  unknown: {
    state: "unknown",
    admitsCurrentClaim: false,
    corroborated: null,
    needsHumanRead: false,
  },
} as const;

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isValidWindows(windows: CoverageWindows): boolean {
  return (
    isNonNegativeFinite(windows.staleHours) &&
    isNonNegativeFinite(windows.expirationHours) &&
    windows.expirationHours >= windows.staleHours
  );
}

/**
 * Classify one admissible-evidence summary into exactly one CoverageState.
 *
 * Pure and total. Every path returns a CoverageState; any unusable
 * configuration, missing evidence, malformed age, or internally inconsistent
 * summary fails closed to `unknown` rather than inventing confidence.
 *
 * Precedence, once configuration and age are valid:
 *   1. no admissible observed row ever  -> `unknown`
 *   2. newest age > expirationHours      -> `absent`   (was covered, now expired)
 *   3. newest age > staleHours           -> `stale`    (ageing; confirm before relying)
 *   4. fresh window has a conflict       -> `conflicting`
 *   5. fresh distinct sources >= min     -> `sufficient`
 *   6. fresh distinct sources >= 1        -> `weak`
 *   7. otherwise (inconsistent summary)  -> `unknown`
 */
export function classifyCoverageState(
  summary: AdmissibleEvidenceSummary,
  options: ClassifyCoverageOptions = {}
): CoverageState {
  const windows = options.windows ?? ADR006_COVERAGE_WINDOWS;
  const minSources = options.corroborationMinSources ?? DEFAULT_CORROBORATION_MIN_SOURCES;

  // Fail closed on any unusable configuration.
  if (!isValidWindows(windows)) return "unknown";
  if (!Number.isInteger(minSources) || minSources < 1) return "unknown";

  const age = summary.newestAdmissibleAgeHours;

  // No admissible observed evidence has ever existed for this subject.
  if (age === null) return "unknown";

  // Malformed age fails closed rather than being treated as fresh.
  if (!isNonNegativeFinite(age)) return "unknown";

  // Expired history: known once, now older than the expiration window.
  if (age > windows.expirationHours) return "absent";

  // Stale window: nothing inside the fresh window, newest still within expiry.
  if (age > windows.staleHours) return "stale";

  // Fresh window (age <= staleHours). Disagreement outranks corroboration.
  if (summary.freshWindowHasConflict) return "conflicting";

  const sources = summary.freshDistinctSourceCount;

  // A fresh age with no fresh source row is internally inconsistent: fail closed.
  if (!Number.isInteger(sources) || sources < 1) return "unknown";

  return sources >= minSources ? "sufficient" : "weak";
}
