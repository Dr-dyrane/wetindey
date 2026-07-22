/**
 * ADR-021 P2 redacted audit writer and retention purge (INERT).
 *
 * Every phase transition the orchestrator commits is recorded as ONE redacted
 * row in the frozen 0018 `deletion_audit` table, whose only columns are
 * request_id, from_phase, to_phase, reason_code, challenge_hash, attempt, and
 * created_at. There is deliberately no column for email, OTP, session token, raw
 * challenge, coordinates, Blob URL or key, raw provider response, stack trace,
 * or payload, so those values have nowhere to leak. `assertRedactedAudit`
 * enforces this a second time in application code: an append carrying any
 * non-allowed or forbidden-looking field is rejected before it can be written.
 *
 * The purge step is the retention tail: it DELETEs terminal requests and their
 * audit rows once they age past a caller-supplied cutoff, audit first so the
 * foreign key is respected. It is inert like the rest of P2, encoding the
 * statements and driving only an injected sink.
 */

import type { DeletionPhase } from "./types";
import { DeletionNotWiredError } from "./cleanup";

const REASON_CODE_PATTERN = /^[a-z0-9_]{2,64}$/;
const CHALLENGE_HASH_PATTERN = /^[0-9a-f]{64}$/;

/** The redacted shape written to `deletion_audit`. No other field is permitted. */
export interface DeletionAuditAppend {
  readonly requestId: string;
  readonly fromPhase: DeletionPhase | null;
  readonly toPhase: DeletionPhase;
  readonly reasonCode: string;
  readonly challengeHash: string | null;
  readonly attempt: number;
}

/** The only property names an audit append may carry. */
export const DELETION_AUDIT_ALLOWED_KEYS = [
  "requestId",
  "fromPhase",
  "toPhase",
  "reasonCode",
  "challengeHash",
  "attempt",
] as const satisfies readonly (keyof DeletionAuditAppend)[];

/**
 * Substrings that must never appear in an audit field name. This is the same
 * redaction posture the P1 contract asserts against the table's columns, applied
 * here to the in-memory append so a widened caller cannot smuggle PII in.
 */
const FORBIDDEN_AUDIT_KEY_FRAGMENTS = [
  "email",
  "otp",
  "token",
  "session",
  "password",
  "secret",
  "cookie",
  "coordinate",
  "latitude",
  "longitude",
  "geom",
  "geograph",
  "blob",
  "url",
  "payload",
  "response",
  "stack",
  "backtrace",
  "traceback",
  "body",
  "address",
  "phone",
] as const;

export class DeletionAuditRedactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeletionAuditRedactionError";
  }
}

/**
 * Fails closed if an append is not exactly the redacted shape: any extra field,
 * any forbidden-looking field name, a reason code outside `^[a-z0-9_]{2,64}$`, a
 * challenge hash that is neither null nor 64-hex, or a negative/non-integer
 * attempt all throw before the row can be built.
 */
export function assertRedactedAudit(row: DeletionAuditAppend): void {
  const allowed = DELETION_AUDIT_ALLOWED_KEYS as readonly string[];
  for (const key of Object.keys(row)) {
    if (!allowed.includes(key)) {
      throw new DeletionAuditRedactionError(
        `audit row carries a non-allowed field '${key}'`,
      );
    }
    const lower = key.toLowerCase();
    for (const fragment of FORBIDDEN_AUDIT_KEY_FRAGMENTS) {
      if (lower.includes(fragment)) {
        throw new DeletionAuditRedactionError(
          `audit row field '${key}' matches forbidden fragment '${fragment}'`,
        );
      }
    }
  }
  if (!REASON_CODE_PATTERN.test(row.reasonCode)) {
    throw new DeletionAuditRedactionError(
      "audit reason_code must match ^[a-z0-9_]{2,64}$",
    );
  }
  if (row.challengeHash !== null && !CHALLENGE_HASH_PATTERN.test(row.challengeHash)) {
    throw new DeletionAuditRedactionError(
      "audit challenge_hash must be null or a 64-hex digest",
    );
  }
  if (!Number.isInteger(row.attempt) || row.attempt < 0) {
    throw new DeletionAuditRedactionError(
      "audit attempt must be a non-negative integer",
    );
  }
}

/** The canonical redacted INSERT. Only the seven safe columns are ever named. */
export function buildAuditInsert(row: DeletionAuditAppend): {
  text: string;
  values: unknown[];
} {
  assertRedactedAudit(row);
  return {
    text:
      'INSERT INTO "deletion_audit" ' +
      '("request_id", "from_phase", "to_phase", "reason_code", "challenge_hash", "attempt") ' +
      "VALUES ($1, $2, $3, $4, $5, $6)",
    values: [
      row.requestId,
      row.fromPhase,
      row.toPhase,
      row.reasonCode,
      row.challengeHash,
      row.attempt,
    ],
  };
}

/** Where a validated audit row is handed for durable append. */
export interface DeletionAuditSink {
  append(row: DeletionAuditAppend): Promise<void>;
}

/**
 * The redacted audit writer. It validates every append, then hands it to an
 * injected sink. With no sink wired it throws `DeletionNotWiredError`, so an
 * unwired writer cannot silently drop audit rows.
 */
export class DeletionAuditWriter implements DeletionAuditSink {
  private readonly sink: DeletionAuditSink | null;

  constructor(config?: { sink?: DeletionAuditSink | null }) {
    this.sink = config?.sink ?? null;
  }

  isWired(): boolean {
    return this.sink !== null;
  }

  async append(row: DeletionAuditAppend): Promise<void> {
    assertRedactedAudit(row);
    if (!this.sink) {
      throw new DeletionNotWiredError("audit");
    }
    await this.sink.append(row);
  }
}

export class DeletionPurgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeletionPurgeError";
  }
}

export interface PurgeStatement {
  readonly text: string;
  readonly values: readonly [Date];
}

/**
 * The retention purge, as two ordered statements. Only TERMINAL requests
 * (outcome <> 'pending') that have not been touched since the cutoff are
 * eligible, so an in-flight saga is never purged. Audit rows are deleted first
 * because `deletion_audit.request_id` references `deletion_requests` with
 * ON DELETE NO ACTION.
 */
export function buildPurgeStatements(
  before: Date,
): readonly [PurgeStatement, PurgeStatement] {
  if (!(before instanceof Date) || Number.isNaN(before.getTime())) {
    throw new DeletionPurgeError("purge cutoff must be a valid Date");
  }
  return [
    {
      text:
        'DELETE FROM "deletion_audit" WHERE "request_id" IN (' +
        'SELECT "id" FROM "deletion_requests" ' +
        "WHERE \"outcome\" <> 'pending' AND \"updated_at\" < $1)",
      values: [before],
    },
    {
      text:
        'DELETE FROM "deletion_requests" ' +
        "WHERE \"outcome\" <> 'pending' AND \"updated_at\" < $1",
      values: [before],
    },
  ];
}

/** Runs a purge statement against a fixture/credential; returns rows affected. */
export interface PurgeExecutor {
  execute(statement: PurgeStatement): Promise<number>;
}

export interface PurgeResult {
  readonly auditRowsPurged: number;
  readonly requestsPurged: number;
}

/**
 * The inert purge adapter. With an executor it deletes aged terminal rows in the
 * FK-safe order; with none it throws `DeletionNotWiredError`.
 */
export class DeletionPurgeAdapter {
  private readonly executor: PurgeExecutor | null;

  constructor(config?: { executor?: PurgeExecutor | null }) {
    this.executor = config?.executor ?? null;
  }

  isWired(): boolean {
    return this.executor !== null;
  }

  async run(before: Date): Promise<PurgeResult> {
    if (!this.executor) {
      throw new DeletionNotWiredError("purge");
    }
    const [audit, requests] = buildPurgeStatements(before);
    const auditRowsPurged = await this.executor.execute(audit);
    const requestsPurged = await this.executor.execute(requests);
    return { auditRowsPurged, requestsPurged };
  }
}
