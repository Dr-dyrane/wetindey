import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { Pool } from "pg";

import {
  parseContributionAdmission,
  type ContributionAdmissionInput,
} from "@/lib/validation";

const CONTRIBUTION_RELEASE =
  "0013:052769850c3d633230d9ec109c2b09067b73a686cadb7c139a613622184f0f0a";
// Vercel supplies and overwrites this value at its trusted proxy boundary.
// Never substitute the client-controlled x-forwarded-for header.
const TRUSTED_NETWORK_HEADER = "x-vercel-forwarded-for";
const ANONYMOUS_SUBJECT_COOKIE = "__Host-wd_contribution_subject";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ADMIT_ARGUMENT_TYPES = [
  "public.contribution_operation",
  "pg_catalog.uuid",
  "pg_catalog.text",
  "pg_catalog.text",
  "pg_catalog.text",
  "pg_catalog.uuid",
  "pg_catalog.uuid",
  "pg_catalog.uuid",
  "pg_catalog.uuid",
  "pg_catalog.text",
  "pg_catalog.int4",
  "pg_catalog.timestamp",
  "pg_catalog.bool",
  "pg_catalog.uuid",
] as const;

const CAPABILITY_SQL = `
SELECT
  has_function_privilege(current_user, procedure.oid, 'EXECUTE') AS can_execute,
  pg_has_role(current_user, 'wetindey_contribution_runtime', 'USAGE') AS runtime_member
FROM pg_catalog.pg_proc AS procedure
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname = 'public'
  AND procedure.proname = 'contribution_admit'
  AND procedure.prokind = 'f'
  AND procedure.pronargs = 14
  AND ARRAY(
    SELECT type_namespace.nspname || '.' || argument_type.typname
    FROM unnest(procedure.proargtypes::oid[]) WITH ORDINALITY AS argument(type_oid, position)
    JOIN pg_catalog.pg_type AS argument_type ON argument_type.oid = argument.type_oid
    JOIN pg_catalog.pg_namespace AS type_namespace ON type_namespace.oid = argument_type.typnamespace
    ORDER BY argument.position
  ) = $1::text[]
`;

const ADMIT_SQL = `
SELECT
  admitted.request_id::text,
  admitted.observation_id::text,
  admitted.result_code,
  admitted.replayed,
  admitted.retry_after_seconds
FROM public.contribution_admit(
  $1::public.contribution_operation,
  $2::uuid,
  $3::text,
  $4::text,
  $5::text,
  $6::uuid,
  $7::uuid,
  $8::uuid,
  $9::uuid,
  $10::text,
  $11::integer,
  $12::timestamp,
  $13::boolean,
  $14::uuid
) AS admitted
`;

interface ContributionConfiguration {
  databaseUrl: string;
  hmacSecret: string;
}

interface QueryResult {
  rows: unknown[];
}

export interface ContributionQueryExecutor {
  query(statement: string, values: unknown[]): Promise<QueryResult>;
}

export interface ContributionRuntimeDependencies {
  environment: NodeJS.ProcessEnv;
  createExecutor(connectionString: string): ContributionQueryExecutor;
  parseInput(data: unknown): ContributionAdmissionInput;
  readActorId(): Promise<string | null>;
  readTrustedNetwork(headerName: string): Promise<string | null>;
  readAnonymousSubject(): Promise<string>;
  now(): Date;
}

export type ContributionAdmissionResult =
  | { code: "maintenance" }
  | { code: "invalid_input" }
  | { code: "reporting_disabled"; requestId: string }
  | {
      code: "rate_limited";
      requestId: string;
      retryAfterSeconds: number;
    }
  | { code: "idempotency_conflict"; requestId: string }
  | {
      code: "received_for_review";
      requestId: string;
      observationId: string;
      replayed: boolean;
    };

let sharedExecutor:
  | { connectionString: string; executor: ContributionQueryExecutor }
  | undefined;

function configurationFromEnvironment(
  environment: NodeJS.ProcessEnv
): ContributionConfiguration | null {
  if (environment.CONTRIBUTION_ADMISSION_ENABLED !== "true") return null;
  if (environment.CONTRIBUTION_ADMISSION_RELEASE !== CONTRIBUTION_RELEASE) {
    return null;
  }

  const databaseUrl =
    environment.CONTRIBUTION_RUNTIME_DATABASE_URL_UNPOOLED?.trim();
  const hmacSecret = environment.CONTRIBUTION_HMAC_SECRET;
  const trustedHeader =
    environment.CONTRIBUTION_TRUSTED_NETWORK_HEADER?.trim().toLowerCase();

  if (!databaseUrl || !hmacSecret || hmacSecret.length < 32) return null;
  if (trustedHeader !== TRUSTED_NETWORK_HEADER) return null;

  return { databaseUrl, hmacSecret };
}

function defaultCreateExecutor(
  connectionString: string
): ContributionQueryExecutor {
  if (
    sharedExecutor &&
    sharedExecutor.connectionString === connectionString
  ) {
    return sharedExecutor.executor;
  }

  const pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 10_000,
    query_timeout: 5_000,
    allowExitOnIdle: true,
  });
  const executor: ContributionQueryExecutor = {
    query: async (statement, values) => pool.query(statement, values),
  };
  sharedExecutor = { connectionString, executor };
  return executor;
}

async function defaultReadActorId(): Promise<string | null> {
  const { auth } = await import("@/lib/auth");
  const { data: session } = await auth.getSession();
  const actorId = session?.user?.id;

  if (actorId == null) return null;
  if (typeof actorId !== "string" || !UUID_PATTERN.test(actorId)) {
    throw new Error("Contribution session actor is not a UUID.");
  }
  return actorId.toLowerCase();
}

async function defaultReadTrustedNetwork(
  headerName: string
): Promise<string | null> {
  const { headers } = await import("next/headers");
  const value = (await headers()).get(headerName)?.trim();
  if (!value || isIP(value) === 0) return null;
  return value;
}

async function defaultReadAnonymousSubject(): Promise<string> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const existing = cookieStore.get(ANONYMOUS_SUBJECT_COOKIE)?.value;
  if (existing && UUID_PATTERN.test(existing)) return existing.toLowerCase();

  const subject = randomUUID();
  cookieStore.set(ANONYMOUS_SUBJECT_COOKIE, subject, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return subject;
}

const defaultDependencies: ContributionRuntimeDependencies = {
  environment: process.env,
  createExecutor: defaultCreateExecutor,
  parseInput: parseContributionAdmission,
  readActorId: defaultReadActorId,
  readTrustedNetwork: defaultReadTrustedNetwork,
  readAnonymousSubject: defaultReadAnonymousSubject,
  now: () => new Date(),
};

function hmac(secret: string, domain: string, value: string): string {
  return createHmac("sha256", secret)
    .update(`${domain}\0${value}`, "utf8")
    .digest("hex");
}

function utcTimestamp(date: Date): string {
  return date.toISOString().slice(0, -1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function hasExactAdmissionCapability(
  executor: ContributionQueryExecutor
): Promise<boolean> {
  const result = await executor.query(CAPABILITY_SQL, [
    [...ADMIT_ARGUMENT_TYPES],
  ]);
  if (result.rows.length !== 1 || !isRecord(result.rows[0])) return false;
  return (
    result.rows[0].can_execute === true &&
    result.rows[0].runtime_member === true
  );
}

function normalizeRpcResult(rows: unknown[]): ContributionAdmissionResult {
  if (rows.length !== 1 || !isRecord(rows[0])) return { code: "maintenance" };

  const row = rows[0];
  const requestId =
    typeof row.request_id === "string" && UUID_PATTERN.test(row.request_id)
      ? row.request_id
      : null;
  const observationId =
    typeof row.observation_id === "string" &&
    UUID_PATTERN.test(row.observation_id)
      ? row.observation_id
      : null;

  if (row.result_code === "reporting_disabled" && requestId) {
    return { code: "reporting_disabled", requestId };
  }
  if (
    row.result_code === "rate_limited" &&
    requestId &&
    Number.isInteger(row.retry_after_seconds) &&
    (row.retry_after_seconds as number) > 0
  ) {
    return {
      code: "rate_limited",
      requestId,
      retryAfterSeconds: row.retry_after_seconds as number,
    };
  }
  if (row.result_code === "idempotency_conflict" && requestId) {
    return { code: "idempotency_conflict", requestId };
  }
  if (
    row.result_code === "pending_review" &&
    requestId &&
    observationId &&
    typeof row.replayed === "boolean"
  ) {
    return {
      code: "received_for_review",
      requestId,
      observationId,
      replayed: row.replayed,
    };
  }
  return { code: "maintenance" };
}

export async function admitFoodContribution(
  data: unknown,
  dependencies: ContributionRuntimeDependencies = defaultDependencies
): Promise<ContributionAdmissionResult> {
  // This is the containment door. Nothing request-, identity-, or
  // database-related may move above this configuration decision.
  const configuration = configurationFromEnvironment(dependencies.environment);
  if (!configuration) return { code: "maintenance" };

  let executor: ContributionQueryExecutor;
  try {
    executor = dependencies.createExecutor(configuration.databaseUrl);
    if (!(await hasExactAdmissionCapability(executor))) {
      return { code: "maintenance" };
    }
  } catch {
    return { code: "maintenance" };
  }

  let input: ContributionAdmissionInput;
  try {
    input = dependencies.parseInput(data);
  } catch {
    return { code: "invalid_input" };
  }

  try {
    const actorId = await dependencies.readActorId();
    const trustedNetwork = await dependencies.readTrustedNetwork(
      TRUSTED_NETWORK_HEADER
    );
    if (!trustedNetwork) return { code: "maintenance" };

    const subjectValue =
      actorId === null
        ? `anonymous:${await dependencies.readAnonymousSubject()}`
        : `account:${actorId}`;
    const priceAmount =
      input.availabilityState === "available"
        ? Math.round(input.priceAmount * 100)
        : null;
    const normalizedPayload = JSON.stringify([
      "report_price",
      input.itemVariantId,
      input.unitId,
      input.placeId,
      input.availabilityState,
      priceAmount,
    ]);

    const admitted = await executor.query(ADMIT_SQL, [
      "report_price",
      input.idempotencyKey,
      hmac(configuration.hmacSecret, "subject", subjectValue),
      hmac(configuration.hmacSecret, "network", trustedNetwork),
      hmac(configuration.hmacSecret, "payload", normalizedPayload),
      actorId,
      input.itemVariantId,
      input.unitId,
      input.placeId,
      input.availabilityState,
      priceAmount,
      utcTimestamp(dependencies.now()),
      null,
      null,
    ]);
    return normalizeRpcResult(admitted.rows);
  } catch {
    return { code: "maintenance" };
  }
}
