/**
 * ADR-028 / ADR-021 deterministic Blob key layout for evidence-media.
 *
 * The key layout is EXACTLY `contribution-evidence/{reportId}/{mediaId}.{ext}`
 * where `reportId` is the pending observation id. This exactness is a hard
 * requirement: the deletion saga (ADR-021) enumerates a report's media by the
 * per-report prefix `contribution-evidence/{reportId}/` and deletes by exact
 * key, so a drifted layout would orphan objects. This module is pure and holds
 * no I/O; the private Blob adapter in `store.ts` is the only caller that lists
 * or deletes.
 */

import {
  EVIDENCE_MEDIA_EXTS,
  EVIDENCE_MEDIA_PREFIX_ROOT,
  isEvidenceMediaExt,
  type EvidenceMediaExt,
} from "./types";

/** RFC 4122 v1-8 UUID, lowercased. reportId and mediaId are both UUIDs. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class EvidenceMediaKeyError extends Error {
  constructor(
    message: string,
    readonly reason: "invalid_report_id" | "invalid_media_id" | "invalid_ext" | "malformed_key",
  ) {
    super(message);
    this.name = "EvidenceMediaKeyError";
  }
}

export interface EvidenceMediaKeyParts {
  readonly reportId: string;
  readonly mediaId: string;
  readonly ext: EvidenceMediaExt;
}

function normalizeUuid(value: string): string | null {
  const lowered = value.trim().toLowerCase();
  return UUID_PATTERN.test(lowered) ? lowered : null;
}

/**
 * The per-report enumeration prefix, `contribution-evidence/{reportId}/`. The
 * deletion saga lists this page-by-page to find every object bound to a report.
 * A trailing slash is mandatory so a prefix for `{reportId}` can never match a
 * different report whose id shares a leading substring.
 */
export function evidenceMediaReportPrefix(reportId: string): string {
  const normalized = normalizeUuid(reportId);
  if (!normalized) {
    throw new EvidenceMediaKeyError(
      "evidence-media report prefix requires a UUID reportId",
      "invalid_report_id",
    );
  }
  return `${EVIDENCE_MEDIA_PREFIX_ROOT}/${normalized}/`;
}

/**
 * The exact object key `contribution-evidence/{reportId}/{mediaId}.{ext}`.
 * Fails closed on any non-UUID id or non-allowlisted extension.
 */
export function evidenceMediaKey(parts: EvidenceMediaKeyParts): string {
  const reportId = normalizeUuid(parts.reportId);
  if (!reportId) {
    throw new EvidenceMediaKeyError(
      "evidence-media key requires a UUID reportId",
      "invalid_report_id",
    );
  }
  const mediaId = normalizeUuid(parts.mediaId);
  if (!mediaId) {
    throw new EvidenceMediaKeyError(
      "evidence-media key requires a UUID mediaId",
      "invalid_media_id",
    );
  }
  if (!isEvidenceMediaExt(parts.ext)) {
    throw new EvidenceMediaKeyError(
      `evidence-media key ext must be one of ${EVIDENCE_MEDIA_EXTS.join(", ")}`,
      "invalid_ext",
    );
  }
  return `${evidenceMediaReportPrefix(reportId)}${mediaId}.${parts.ext}`;
}

/**
 * Parse a key back into its parts, validating layout, ids, and extension. Used
 * by the deletion enumeration to confirm a listed object belongs to the report
 * before it is deleted, and by the contract test to prove round-trip exactness.
 */
export function parseEvidenceMediaKey(key: string): EvidenceMediaKeyParts {
  const segments = key.split("/");
  if (segments.length !== 3 || segments[0] !== EVIDENCE_MEDIA_PREFIX_ROOT) {
    throw new EvidenceMediaKeyError(
      "evidence-media key must be contribution-evidence/{reportId}/{mediaId}.{ext}",
      "malformed_key",
    );
  }
  const reportId = normalizeUuid(segments[1]);
  if (!reportId) {
    throw new EvidenceMediaKeyError(
      "evidence-media key reportId segment is not a UUID",
      "invalid_report_id",
    );
  }
  const object = segments[2];
  const dot = object.lastIndexOf(".");
  if (dot <= 0) {
    throw new EvidenceMediaKeyError(
      "evidence-media key object segment must be {mediaId}.{ext}",
      "malformed_key",
    );
  }
  const mediaId = normalizeUuid(object.slice(0, dot));
  if (!mediaId) {
    throw new EvidenceMediaKeyError(
      "evidence-media key mediaId segment is not a UUID",
      "invalid_media_id",
    );
  }
  const ext = object.slice(dot + 1);
  if (!isEvidenceMediaExt(ext)) {
    throw new EvidenceMediaKeyError(
      `evidence-media key ext must be one of ${EVIDENCE_MEDIA_EXTS.join(", ")}`,
      "invalid_ext",
    );
  }
  return { reportId, mediaId, ext };
}

/** True when `key` sits under the exact per-report prefix. Enumeration guard. */
export function isKeyForReport(key: string, reportId: string): boolean {
  let prefix: string;
  try {
    prefix = evidenceMediaReportPrefix(reportId);
  } catch {
    return false;
  }
  return key.startsWith(prefix);
}
