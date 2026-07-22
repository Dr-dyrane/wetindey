import { createHash } from "node:crypto";

import { Pool } from "pg";

const MODERATION_RELEASE = "0015:moderation-operations-v1";
const MODERATOR_ROLE = "wetindey_contribution_moderator";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RPC_SIGNATURES = [
  "public.contribution_pending_queue(uuid,integer)",
  "public.contribution_review_detail(uuid,uuid)",
  "public.contribution_moderate(uuid,uuid,text,uuid,public.contribution_decision,text,uuid)",
  "public.contribution_audit_for_observation(uuid,uuid,integer)",
] as const;

const CAPABILITY_SQL = `
  SELECT
    COALESCE(bool_and(
      pg_catalog.to_regprocedure(signature) IS NOT NULL
      AND pg_catalog.has_function_privilege(
        pg_catalog.current_user,
        pg_catalog.to_regprocedure(signature),
        'EXECUTE'
      )
    ), false) AS rpc_access,
    pg_catalog.pg_has_role(pg_catalog.session_user, $2::name, 'MEMBER') AS moderator_member
  FROM unnest($1::text[]) AS requested(signature)
`;
const QUEUE_SQL = `SELECT * FROM public.contribution_pending_queue($1::uuid, $2::integer)`;
const DETAIL_SQL = `SELECT * FROM public.contribution_review_detail($1::uuid, $2::uuid)`;
const MODERATE_SQL = `SELECT * FROM public.contribution_moderate($1::uuid, $2::uuid, $3::text, $4::uuid, $5::public.contribution_decision, $6::text, $7::uuid)`;
const AUDIT_SQL = `SELECT * FROM public.contribution_audit_for_observation($1::uuid, $2::uuid, $3::integer)`;

export const MODERATION_REASON_CODES = {
  approve: ["evidence_sufficient", "independent_confirmation"],
  reject: ["evidence_insufficient", "claim_conflicts", "policy_violation"],
  reverse: ["new_evidence", "decision_error"],
} as const;

export type ModerationDecision = keyof typeof MODERATION_REASON_CODES;
export type ModerationReasonCode = (typeof MODERATION_REASON_CODES)[ModerationDecision][number];
type QueryResult = { rows: unknown[] };
export type ModerationQueryExecutor = { query(statement: string, values: readonly unknown[]): Promise<QueryResult> };
type ModerationEnvironment = Partial<
  Record<
    | "CONTRIBUTION_MODERATION_UI_ENABLED"
    | "CONTRIBUTION_MODERATION_RELEASE"
    | "CONTRIBUTION_MODERATOR_DATABASE_URL_UNPOOLED",
    string
  >
>;
type Dependencies = {
  environment: ModerationEnvironment;
  createExecutor(connectionString: string): ModerationQueryExecutor;
  readActorId(): Promise<string | null>;
};

export type ModerationQueueItem = {
  observationId: string;
  availabilityState: "available" | "unavailable";
  priceAmountKobo: number | null;
  observedAt: string;
  submittedAt: string;
  collectionMethod: string;
  correctsPriorEvidence: boolean;
  attributed: boolean;
};
export type ModerationReviewDetail = {
  observationId: string;
  itemLabel: string;
  variantLabel: string | null;
  unitLabel: string;
  placeLabel: string;
  availabilityState: "available" | "unavailable";
  priceAmountKobo: number | null;
  observedAt: string;
  submittedAt: string;
  collectionMethod: string;
  correctsPriorEvidence: boolean;
  attributed: boolean;
  hasDecisionHistory: boolean;
  reopenedAfterReversal: boolean;
  activeDecisionId: string | null;
  canReverse: boolean;
};
export type ModerationAuditEntry = {
  action: "admission" | "approved" | "rejected" | "reversed" | "projection_updated";
  actor: "you" | "another_moderator";
  reasonCode: string | null;
  createdAt: string;
};
export type ModerationRuntimeResult<T> =
  | { code: "ready"; value: T }
  | { code: "replayed"; value: T }
  | { code: "forbidden" | "session_expired" | "conflict" | "unavailable" };
export type ModerationCommand = {
  requestId: string;
  observationId: string;
  decision: ModerationDecision;
  reasonCode: ModerationReasonCode;
  priorDecisionId: string | null;
};

let sharedExecutor: { connectionString: string; executor: ModerationQueryExecutor } | null = null;

function configurationFromEnvironment(environment: ModerationEnvironment): { databaseUrl: string } | null {
  if (environment.CONTRIBUTION_MODERATION_UI_ENABLED !== "true") return null;
  if (environment.CONTRIBUTION_MODERATION_RELEASE !== MODERATION_RELEASE) return null;
  const databaseUrl = environment.CONTRIBUTION_MODERATOR_DATABASE_URL_UNPOOLED?.trim();
  return databaseUrl ? { databaseUrl } : null;
}
function defaultCreateExecutor(connectionString: string): ModerationQueryExecutor {
  if (sharedExecutor?.connectionString === connectionString) return sharedExecutor.executor;
  const pool = new Pool({ connectionString, max: 2 });
  const executor = { query: async (statement: string, values: readonly unknown[]) => pool.query(statement, values as unknown[]) };
  sharedExecutor = { connectionString, executor };
  return executor;
}
async function defaultReadActorId(): Promise<string | null> {
  const { auth } = await import("@/lib/auth");
  const { data: session } = await auth.getSession();
  const actorId = session?.user?.id;
  return typeof actorId === "string" && UUID_PATTERN.test(actorId) ? actorId.toLowerCase() : null;
}
const defaultDependencies: Dependencies = { environment: process.env as ModerationEnvironment, createExecutor: defaultCreateExecutor, readActorId: defaultReadActorId };
function isUuid(value: unknown): value is string { return typeof value === "string" && UUID_PATTERN.test(value); }
function iso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}
function isReasonCode(decision: ModerationDecision, code: string): code is ModerationReasonCode {
  return (MODERATION_REASON_CODES[decision] as readonly string[]).includes(code);
}
async function usableExecutor(dependencies: Dependencies): Promise<{ executor: ModerationQueryExecutor; actorId: string } | ModerationRuntimeResult<never>> {
  // Configuration is intentionally evaluated before auth, pool creation, or SQL.
  const configuration = configurationFromEnvironment(dependencies.environment);
  if (!configuration) return { code: "unavailable" };
  let actorId: string | null;
  try {
    actorId = await dependencies.readActorId();
  } catch {
    return { code: "unavailable" };
  }
  if (!actorId) return { code: "session_expired" };
  let executor: ModerationQueryExecutor;
  try {
    executor = dependencies.createExecutor(configuration.databaseUrl);
    const probe = await executor.query(CAPABILITY_SQL, [RPC_SIGNATURES, MODERATOR_ROLE]);
    const row = probe.rows[0] as { rpc_access?: unknown; moderator_member?: unknown } | undefined;
    if (row?.rpc_access !== true) return { code: "unavailable" };
    if (row.moderator_member !== true) return { code: "forbidden" };
  } catch { return { code: "unavailable" }; }
  return { executor, actorId };
}
function queueItem(row: unknown): ModerationQueueItem | null {
  const value = row as Record<string, unknown>;
  const observedAt = iso(value.observed_at);
  const submittedAt = iso(value.submitted_at);
  if (!isUuid(value.observation_id) || !observedAt || !submittedAt) return null;
  if (value.availability_state !== "available" && value.availability_state !== "unavailable") return null;
  const amount = value.price_amount;
  if (amount !== null && (!Number.isInteger(amount) || (amount as number) < 0)) return null;
  return { observationId: value.observation_id, availabilityState: value.availability_state, priceAmountKobo: amount as number | null, observedAt, submittedAt, collectionMethod: typeof value.collection_method === "string" ? value.collection_method : "unknown", correctsPriorEvidence: isUuid(value.corrects_observation_id), attributed: value.attributed === true };
}
function reviewDetail(row: unknown): ModerationReviewDetail | null {
  const value = row as Record<string, unknown>;
  const observedAt = iso(value.observed_at);
  const submittedAt = iso(value.submitted_at);
  if (!isUuid(value.observation_id) || !observedAt || !submittedAt) return null;
  if (value.availability_state !== "available" && value.availability_state !== "unavailable") return null;
  if (typeof value.item_label !== "string" || typeof value.unit_label !== "string" || typeof value.place_label !== "string") return null;
  const amount = value.price_amount;
  const activeDecisionId = isUuid(value.effective_decision_id) ? value.effective_decision_id : null;
  return { observationId: value.observation_id, itemLabel: value.item_label, variantLabel: typeof value.variant_label === "string" ? value.variant_label : null, unitLabel: value.unit_label, placeLabel: value.place_label, availabilityState: value.availability_state, priceAmountKobo: Number.isInteger(amount) ? (amount as number) : null, observedAt, submittedAt, collectionMethod: typeof value.collection_method === "string" ? value.collection_method : "unknown", correctsPriorEvidence: isUuid(value.corrects_observation_id), attributed: value.attributed === true, hasDecisionHistory: value.has_decision_history === true, reopenedAfterReversal: value.reopened_after_reversal === true, activeDecisionId, canReverse: activeDecisionId !== null && value.actor_made_effective_decision === false };
}
function auditEntry(row: unknown, actorId: string): ModerationAuditEntry | null {
  const value = row as Record<string, unknown>;
  const actionMap: Record<string, ModerationAuditEntry["action"]> = { admission: "admission", moderation_approved: "approved", moderation_rejected: "rejected", moderation_reversed: "reversed", projection_updated: "projection_updated" };
  const action = typeof value.action === "string" ? actionMap[value.action] : undefined;
  const createdAt = iso(value.created_at);
  return action && createdAt ? { action, actor: value.actor_account_id === actorId ? "you" : "another_moderator", reasonCode: typeof value.reason_code === "string" ? value.reason_code : null, createdAt } : null;
}

export async function loadModerationQueue(dependencies: Dependencies = defaultDependencies): Promise<ModerationRuntimeResult<ModerationQueueItem[]>> {
  const usable = await usableExecutor(dependencies);
  if ("code" in usable) return usable;
  try {
    const result = await usable.executor.query(QUEUE_SQL, [usable.actorId, 50]);
    return { code: "ready", value: result.rows.map(queueItem).filter((item): item is ModerationQueueItem => item !== null) };
  } catch { return { code: "forbidden" }; }
}
export async function loadModerationReview(observationId: string, dependencies: Dependencies = defaultDependencies): Promise<ModerationRuntimeResult<{ detail: ModerationReviewDetail; audit: ModerationAuditEntry[] }>> {
  if (!isUuid(observationId)) return { code: "unavailable" };
  const usable = await usableExecutor(dependencies);
  if ("code" in usable) return usable;
  try {
    const [detailResult, auditResult] = await Promise.all([usable.executor.query(DETAIL_SQL, [usable.actorId, observationId]), usable.executor.query(AUDIT_SQL, [usable.actorId, observationId, 50])]);
    const detail = reviewDetail(detailResult.rows[0]);
    if (!detail) return { code: "unavailable" };
    return { code: "ready", value: { detail, audit: auditResult.rows.map((row) => auditEntry(row, usable.actorId)).filter((item): item is ModerationAuditEntry => item !== null) } };
  } catch { return { code: "forbidden" }; }
}
export async function moderateContribution(command: ModerationCommand, dependencies: Dependencies = defaultDependencies): Promise<ModerationRuntimeResult<{ projectionState: "available" | "unavailable" | "conflict" }>> {
  if (!isUuid(command.requestId) || !isUuid(command.observationId) || !isReasonCode(command.decision, command.reasonCode) || (command.decision === "reverse" && !isUuid(command.priorDecisionId)) || (command.decision !== "reverse" && command.priorDecisionId !== null)) return { code: "unavailable" };
  const usable = await usableExecutor(dependencies);
  if ("code" in usable) return usable;
  const digest = createHash("sha256").update(JSON.stringify(["contribution_moderation", usable.actorId, command.observationId, command.decision, command.reasonCode, command.priorDecisionId])).digest("hex");
  try {
    const result = await usable.executor.query(MODERATE_SQL, [usable.actorId, command.requestId, digest, command.observationId, command.decision, command.reasonCode, command.priorDecisionId]);
    const row = result.rows[0] as { projection_state?: unknown; replayed?: unknown } | undefined;
    if (!row || (row.projection_state !== "available" && row.projection_state !== "unavailable" && row.projection_state !== "conflict") || typeof row.replayed !== "boolean") return { code: "unavailable" };
    const value: { projectionState: "available" | "unavailable" | "conflict" } = {
      projectionState: row.projection_state,
    };
    return row.replayed ? { code: "replayed", value } : { code: "ready", value };
  } catch (error) {
    return error instanceof Error && /idempotency|request.*different|payload digest/i.test(error.message) ? { code: "conflict" } : { code: "forbidden" };
  }
}
export const moderationRuntimeForContract = { CAPABILITY_SQL, RPC_SIGNATURES, configurationFromEnvironment, isReasonCode, queueItem };
