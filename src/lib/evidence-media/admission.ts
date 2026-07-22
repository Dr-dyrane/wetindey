/**
 * ADR-028 fail-closed admission + display gating for evidence-media.
 *
 * Admission binds an OPTIONAL media object to the ADR-019 pending boundary: the
 * object is attached to an already-admitted observation (`reportId`) that is
 * still `pending`, is sanitized (EXIF/GPS stripped) before durable retention, is
 * stored PRIVATELY, and is persisted in state `pending`. It is NEVER public and
 * NEVER displayable until an authorized moderation decision moves both the
 * report and the media to `approved`.
 *
 * Every step fails closed: the default-off flag must be on, the report must
 * exist and be pending, the per-report count must be under the limit, and the
 * sanitizer must fully understand the bytes. If any check fails nothing durable
 * is written. Because storage is private and the row starts `pending`, even the
 * transactional gap between the private `put` and the row insert cannot leak a
 * public object.
 *
 * This module is dependency-injected and free of `@vercel/blob`, `next`, and
 * `server-only` imports, so the contract test can exercise it directly.
 */

import {
  EVIDENCE_MEDIA_MAX_PER_REPORT,
  type EvidenceMediaRow,
  type SanitizedEvidenceMedia,
} from "./types";

export class EvidenceMediaAdmissionError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "disabled"
      | "unauthenticated"
      | "not_owner"
      | "report_missing"
      | "report_not_pending"
      | "count_exceeded"
      | "invalid_media",
  ) {
    super(message);
    this.name = "EvidenceMediaAdmissionError";
  }
}

/** The pending report the media binds to, as read inside the ADR-019 boundary. */
export interface AdmittedReport {
  readonly observationId: string;
  readonly moderationStatus: string;
  /** The account that owns the report's source, or null for anonymous rows. */
  readonly ownerAccountId: string | null;
}

export interface EvidenceMediaAdmissionInput {
  readonly observationId: string;
  readonly actorAccountId: string | null;
  readonly sanitized: SanitizedEvidenceMedia;
}

export interface EvidenceMediaAdmissionDeps {
  /** The server admission flag; defaults false elsewhere. */
  isEnabled(): boolean;
  /** Read the report inside the pending boundary, or null if it does not exist. */
  readReport(observationId: string): Promise<AdmittedReport | null>;
  /** How many media objects the report already holds. */
  countExisting(observationId: string): Promise<number>;
  /** Fresh object id for the deterministic key. */
  newMediaId(): string;
  /** Persist the sanitized object privately; returns its exact key. */
  storePut(input: {
    reportId: string;
    mediaId: string;
    sanitized: SanitizedEvidenceMedia;
  }): Promise<{ key: string }>;
  /** Insert the redacted row in state `pending` (decision_id null). */
  persistRow(input: {
    observationId: string;
    mediaId: string;
    sanitized: SanitizedEvidenceMedia;
  }): Promise<EvidenceMediaRow>;
}

/**
 * Attach one optional media object to a pending report. Fail-closed and never
 * publishing. Returns the persisted `pending` row.
 */
export async function admitEvidenceMedia(
  deps: EvidenceMediaAdmissionDeps,
  input: EvidenceMediaAdmissionInput,
): Promise<EvidenceMediaRow> {
  if (!deps.isEnabled()) {
    throw new EvidenceMediaAdmissionError(
      "evidence-media admission is disabled",
      "disabled",
    );
  }

  const report = await deps.readReport(input.observationId);
  if (!report) {
    throw new EvidenceMediaAdmissionError(
      "evidence-media target report does not exist",
      "report_missing",
    );
  }
  if (report.moderationStatus !== "pending") {
    // Media only enters the pending boundary; a resolved report is closed.
    throw new EvidenceMediaAdmissionError(
      "evidence-media can only attach to a pending report",
      "report_not_pending",
    );
  }
  // Owner-scoped: only the report's own contributor may attach. An anonymous
  // report (null owner) accepts no authenticated attach, and vice versa.
  if (report.ownerAccountId !== input.actorAccountId) {
    throw new EvidenceMediaAdmissionError(
      "evidence-media attach is owner-scoped",
      "not_owner",
    );
  }

  const existing = await deps.countExisting(input.observationId);
  if (existing >= EVIDENCE_MEDIA_MAX_PER_REPORT) {
    throw new EvidenceMediaAdmissionError(
      `evidence-media report already holds ${EVIDENCE_MEDIA_MAX_PER_REPORT} objects`,
      "count_exceeded",
    );
  }

  const mediaId = deps.newMediaId();
  // Private durable write first, then the redacted row. If the row insert fails
  // the object is private and unreferenced (never public); ADR-021 enumeration
  // by prefix reclaims it.
  await deps.storePut({
    reportId: input.observationId,
    mediaId,
    sanitized: input.sanitized,
  });
  return deps.persistRow({
    observationId: input.observationId,
    mediaId,
    sanitized: input.sanitized,
  });
}

/**
 * Display gate. A media object is displayable ONLY when its report is approved
 * AND the media itself is approved. Any other combination (pending report,
 * rejected report, pending media, rejected media) is not displayable.
 */
export function isEvidenceMediaDisplayable(input: {
  reportModerationStatus: string;
  mediaState: string;
}): boolean {
  return input.reportModerationStatus === "approved" && input.mediaState === "approved";
}

/** Filter a batch of rows to the displayable subset for an approved report. */
export function selectDisplayableMedia<
  T extends { state: string },
>(reportModerationStatus: string, rows: readonly T[]): T[] {
  return rows.filter((row) =>
    isEvidenceMediaDisplayable({ reportModerationStatus, mediaState: row.state }),
  );
}
