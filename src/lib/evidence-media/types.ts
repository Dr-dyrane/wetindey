/**
 * ADR-028 evidence-media types (single source of truth).
 *
 * This module is pure: it holds only `const` label tuples, the union types
 * derived from them, the MIME/extension allowlist, the fail-closed size and
 * count limits, and plain data-shape interfaces. It imports nothing with a
 * runtime side effect and must never import `server-only`, so both the Drizzle
 * schema (loaded offline by drizzle-kit generate) and server-only adapter code
 * can depend on it. The `EVIDENCE_MEDIA_STATES` tuple is the canonical label
 * set the contract test cross-checks against the `pgEnum` in
 * `src/db/schema/evidence-media.ts` and against the generated migration DDL.
 *
 * Nothing here is public: evidence-media is private and fail-closed. A row is
 * `pending` until an authorized moderation decision moves it to `approved` or
 * `rejected`; display is gated on `approved` joined to an `approved` report.
 */

/**
 * The three media lifecycle states, in declaration order. This order is the
 * order the generated `CREATE TYPE "public"."evidence_media_state"` must
 * preserve. `pending` is the sole non-terminal, non-displayable admitted state;
 * a media row NEVER becomes displayable without an authorized moderation
 * decision recorded in `contribution_moderation_decisions`.
 */
export const EVIDENCE_MEDIA_STATES = ["pending", "approved", "rejected"] as const;

export type EvidenceMediaState = (typeof EVIDENCE_MEDIA_STATES)[number];

/**
 * The allowlisted still-image MIME types and their canonical file extension.
 * The extension is what lands in the deterministic Blob key
 * `contribution-evidence/{reportId}/{mediaId}.{ext}`; enumeration and deletion
 * (ADR-021) depend on it being one of exactly these three values.
 */
export const EVIDENCE_MEDIA_MIME_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const satisfies Record<string, string>;

export type EvidenceMediaMime = keyof typeof EVIDENCE_MEDIA_MIME_EXT;
export type EvidenceMediaExt =
  (typeof EVIDENCE_MEDIA_MIME_EXT)[EvidenceMediaMime];

/** The allowlisted MIME types as a tuple, for membership checks. */
export const EVIDENCE_MEDIA_MIMES = Object.keys(
  EVIDENCE_MEDIA_MIME_EXT,
) as EvidenceMediaMime[];

/** The allowlisted extensions as a tuple, for key validation and DB checks. */
export const EVIDENCE_MEDIA_EXTS = Object.values(
  EVIDENCE_MEDIA_MIME_EXT,
) as EvidenceMediaExt[];

/**
 * Fail-closed size and count limits. Enforced client-side, in the sanitizer,
 * in the admission path, and by database CHECK constraints. A byte size at or
 * below zero or above the max, or a report already at the per-report count, is
 * rejected before anything is written durably.
 */
export const EVIDENCE_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const EVIDENCE_MEDIA_MIN_BYTES = 1;
export const EVIDENCE_MEDIA_MAX_PER_REPORT = 3;

/** The single Blob namespace root. Every object lives under this prefix. */
export const EVIDENCE_MEDIA_PREFIX_ROOT = "contribution-evidence";

export function isEvidenceMediaMime(value: unknown): value is EvidenceMediaMime {
  return typeof value === "string" && value in EVIDENCE_MEDIA_MIME_EXT;
}

export function isEvidenceMediaExt(value: unknown): value is EvidenceMediaExt {
  return (
    typeof value === "string" &&
    (EVIDENCE_MEDIA_EXTS as readonly string[]).includes(value)
  );
}

export function isEvidenceMediaState(
  value: unknown,
): value is EvidenceMediaState {
  return (
    typeof value === "string" &&
    (EVIDENCE_MEDIA_STATES as readonly string[]).includes(value)
  );
}

export function extForMime(mime: EvidenceMediaMime): EvidenceMediaExt {
  return EVIDENCE_MEDIA_MIME_EXT[mime];
}

/**
 * The sanitized, retention-ready descriptor of one media object. It carries
 * REDACTED metadata only: a content hash, byte size, MIME, and extension. There
 * is deliberately no field for EXIF, GPS/coordinates, camera make/model,
 * timestamp-from-metadata, thumbnail, or any raw upload payload. The contract
 * test asserts none of those columns exist on the persisted row.
 */
export interface SanitizedEvidenceMedia {
  readonly bytes: Uint8Array;
  readonly contentType: EvidenceMediaMime;
  readonly ext: EvidenceMediaExt;
  readonly byteSize: number;
  readonly contentSha256: string;
}

/**
 * The persisted `contribution_evidence_media` row shape. `observationId` is the
 * pending report (`reportId`) the media binds to; `mediaId` is the object id in
 * the deterministic key. `decisionId` links to the authorized moderation
 * decision that resolved the media out of `pending`. There is no metadata,
 * coordinate, or payload field: the row is redacted by construction.
 */
export interface EvidenceMediaRow {
  readonly id: string;
  readonly observationId: string;
  readonly mediaId: string;
  readonly ext: EvidenceMediaExt;
  readonly contentType: EvidenceMediaMime;
  readonly byteSize: number;
  readonly contentSha256: string;
  readonly state: EvidenceMediaState;
  readonly decisionId: string | null;
  readonly sanitizedAt: Date;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
}
