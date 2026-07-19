import { createHash, timingSafeEqual } from "node:crypto";
import { Client } from "pg";

const STATEMENT_TIMEOUT = "10s";
const LOCK_TIMEOUT = "2s";
const IDLE_TRANSACTION_TIMEOUT = "15s";

interface PresenceRetentionClient {
  connect(): Promise<unknown>;
  query(statement: string): Promise<unknown>;
  end(): Promise<unknown>;
}

export type PresenceRetentionClientFactory = (connectionString: string) => PresenceRetentionClient;

export interface PresenceRetentionHandlerDependencies {
  readCronSecret(): string | null;
  readConnectionString(): string | null;
  authorize(authorization: string | null, secret: string): boolean;
  cleanup(connectionString: string): Promise<void>;
}

const defaultClientFactory: PresenceRetentionClientFactory = (connectionString) =>
  new Client({
    connectionString,
    application_name: "wetindey_presence_retention_cleanup",
  });

function requiredValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function presenceCronSecretFromEnvironment(): string | null {
  return requiredValue(process.env.CRON_SECRET);
}

export function presenceSafetyDatabaseUrlFromEnvironment(): string | null {
  return requiredValue(process.env.PRESENCE_SAFETY_DATABASE_URL_UNPOOLED);
}

export function isAuthorizedPresenceRetentionRequest(
  authorization: string | null,
  secret: string
): boolean {
  const expected = createHash("sha256").update(`Bearer ${secret.trim()}`).digest();
  const actual = createHash("sha256")
    .update(authorization ?? "")
    .digest();

  return authorization !== null && secret.trim().length > 0 && timingSafeEqual(actual, expected);
}

function emptyResponse(status: 204 | 401 | 503): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export async function runPresenceRetentionCleanup(
  connectionString: string,
  createClient: PresenceRetentionClientFactory = defaultClientFactory
): Promise<void> {
  const client = createClient(connectionString);
  let transactionOpen = false;

  try {
    await client.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query(`SET LOCAL statement_timeout = '${STATEMENT_TIMEOUT}'`);
    await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
    await client.query(
      `SET LOCAL idle_in_transaction_session_timeout = '${IDLE_TRANSACTION_TIMEOUT}'`
    );
    await client.query("SET LOCAL ROLE wetindey_presence_safety");
    await client.query("SELECT public.presence_run_retention_cleanup()");
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original failure without disclosing provider details.
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}

const defaultHandlerDependencies: PresenceRetentionHandlerDependencies = {
  readCronSecret: presenceCronSecretFromEnvironment,
  readConnectionString: presenceSafetyDatabaseUrlFromEnvironment,
  authorize: isAuthorizedPresenceRetentionRequest,
  cleanup: runPresenceRetentionCleanup,
};

export async function handlePresenceRetentionCleanupRequest(
  request: Request,
  dependencies: PresenceRetentionHandlerDependencies = defaultHandlerDependencies
): Promise<Response> {
  const cronSecret = dependencies.readCronSecret();
  const connectionString = dependencies.readConnectionString();

  if (!cronSecret || !connectionString) return emptyResponse(503);
  if (!dependencies.authorize(request.headers.get("authorization"), cronSecret)) {
    return emptyResponse(401);
  }

  try {
    await dependencies.cleanup(connectionString);
    return emptyResponse(204);
  } catch {
    return emptyResponse(503);
  }
}
