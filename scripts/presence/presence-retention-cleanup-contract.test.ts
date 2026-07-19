import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  handlePresenceRetentionCleanupRequest,
  isAuthorizedPresenceRetentionRequest,
  presenceCronSecretFromEnvironment,
  presenceSafetyDatabaseUrlFromEnvironment,
  runPresenceRetentionCleanup,
  type PresenceRetentionClientFactory,
  type PresenceRetentionHandlerDependencies,
} from "../../src/lib/presence-retention-cleanup";

const repoRoot = new URL("../../", import.meta.url);

class RecordingClient {
  readonly statements: string[] = [];
  connected = false;
  ended = false;

  constructor(private readonly failOn?: string) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async query(statement: string): Promise<void> {
    this.statements.push(statement);
    if (statement === this.failOn) {
      throw new Error("simulated database failure");
    }
  }

  async end(): Promise<void> {
    this.ended = true;
  }
}

test("reads only the dedicated safety URL and trims required secrets", () => {
  const originalSafetyUrl = process.env.PRESENCE_SAFETY_DATABASE_URL_UNPOOLED;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalCronSecret = process.env.CRON_SECRET;

  try {
    delete process.env.PRESENCE_SAFETY_DATABASE_URL_UNPOOLED;
    process.env.DATABASE_URL = "postgresql://owner-must-not-be-used";
    process.env.CRON_SECRET = "  cron-value  ";

    assert.equal(presenceSafetyDatabaseUrlFromEnvironment(), null);
    assert.equal(presenceCronSecretFromEnvironment(), "cron-value");

    process.env.PRESENCE_SAFETY_DATABASE_URL_UNPOOLED = "  postgresql://dedicated-safety  ";
    assert.equal(presenceSafetyDatabaseUrlFromEnvironment(), "postgresql://dedicated-safety");
  } finally {
    if (originalSafetyUrl === undefined) {
      delete process.env.PRESENCE_SAFETY_DATABASE_URL_UNPOOLED;
    } else {
      process.env.PRESENCE_SAFETY_DATABASE_URL_UNPOOLED = originalSafetyUrl;
    }
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  }
});

test("authorizes only the exact bearer value with fixed-length comparison", () => {
  assert.equal(isAuthorizedPresenceRetentionRequest("Bearer presence-cron", "presence-cron"), true);
  assert.equal(isAuthorizedPresenceRetentionRequest("Bearer wrong", "presence-cron"), false);
  assert.equal(isAuthorizedPresenceRetentionRequest(null, "presence-cron"), false);
  assert.equal(isAuthorizedPresenceRetentionRequest("Bearer presence-cron", ""), false);
});

test("runs one bounded safety-role cleanup transaction", async () => {
  const client = new RecordingClient();
  const factory: PresenceRetentionClientFactory = () => client;

  await runPresenceRetentionCleanup("postgresql://dedicated-safety", factory);

  assert.equal(client.connected, true);
  assert.equal(client.ended, true);
  assert.deepEqual(client.statements, [
    "BEGIN",
    "SET LOCAL statement_timeout = '10s'",
    "SET LOCAL lock_timeout = '2s'",
    "SET LOCAL idle_in_transaction_session_timeout = '15s'",
    "SET LOCAL ROLE wetindey_presence_safety",
    "SELECT public.presence_run_retention_cleanup()",
    "COMMIT",
  ]);
});

test("rolls back and fails closed when corrected 0012 is unavailable", async () => {
  const client = new RecordingClient("SET LOCAL ROLE wetindey_presence_safety");
  const factory: PresenceRetentionClientFactory = () => client;

  await assert.rejects(
    runPresenceRetentionCleanup("postgresql://dedicated-safety", factory),
    /simulated database failure/
  );
  assert.equal(client.ended, true);
  assert.equal(client.statements.at(-1), "ROLLBACK");
  assert.equal(client.statements.includes("SELECT public.presence_run_retention_cleanup()"), false);
});

test("rolls back when the safety role exists but the cleanup function is absent", async () => {
  const client = new RecordingClient("SELECT public.presence_run_retention_cleanup()");
  const factory: PresenceRetentionClientFactory = () => client;

  await assert.rejects(
    runPresenceRetentionCleanup("postgresql://dedicated-safety", factory),
    /simulated database failure/
  );
  assert.deepEqual(client.statements.slice(-2), [
    "SELECT public.presence_run_retention_cleanup()",
    "ROLLBACK",
  ]);
  assert.equal(client.ended, true);
});

test("executes the private empty-response route matrix", async () => {
  const cleanupCalls: string[] = [];
  const dependencies = (
    overrides: Partial<PresenceRetentionHandlerDependencies> = {}
  ): PresenceRetentionHandlerDependencies => ({
    readCronSecret: () => "presence-cron",
    readConnectionString: () => "postgresql://dedicated-safety",
    authorize: isAuthorizedPresenceRetentionRequest,
    cleanup: async (connectionString) => {
      cleanupCalls.push(connectionString);
    },
    ...overrides,
  });
  const request = (authorization?: string) =>
    new Request("https://wetindey.invalid/api/internal/presence/retention-cleanup?ignored=true", {
      headers: authorization ? { authorization } : {},
    });
  const assertPrivateEmpty = async (response: Response, status: number) => {
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(response.headers.has("content-length"), false);
    assert.equal(await response.text(), "");
  };

  await assertPrivateEmpty(
    await handlePresenceRetentionCleanupRequest(
      request("Bearer presence-cron"),
      dependencies({ readConnectionString: () => null })
    ),
    503
  );
  await assertPrivateEmpty(
    await handlePresenceRetentionCleanupRequest(request("Bearer wrong"), dependencies()),
    401
  );
  assert.equal(cleanupCalls.length, 0);

  await assertPrivateEmpty(
    await handlePresenceRetentionCleanupRequest(request("Bearer presence-cron"), dependencies()),
    204
  );
  assert.deepEqual(cleanupCalls, ["postgresql://dedicated-safety"]);

  await assertPrivateEmpty(
    await handlePresenceRetentionCleanupRequest(
      request("Bearer presence-cron"),
      dependencies({
        cleanup: async () => {
          throw new Error("simulated database failure");
        },
      })
    ),
    503
  );
});

test("route and deployment configuration stay private and narrow", async () => {
  const route = await readFile(
    new URL("src/app/api/internal/presence/retention-cleanup/route.ts", repoRoot),
    "utf8"
  );
  const helper = await readFile(new URL("src/lib/presence-retention-cleanup.ts", repoRoot), "utf8");
  const vercel = JSON.parse(await readFile(new URL("vercel.json", repoRoot), "utf8")) as {
    crons?: Array<{ path: string; schedule: string }>;
  };
  const envExample = await readFile(new URL(".env.example", repoRoot), "utf8");

  assert.match(route, /export async function GET\(/);
  assert.doesNotMatch(route, /export async function (?:POST|PUT|PATCH|DELETE)\(/);
  assert.doesNotMatch(
    route,
    /cookies\(|request\.(?:json|text)\(|request\.url|searchParams|console\./
  );
  assert.match(route, /handlePresenceRetentionCleanupRequest\(request\)/);

  assert.match(helper, /process\.env\.PRESENCE_SAFETY_DATABASE_URL_UNPOOLED/);
  assert.doesNotMatch(helper, /process\.env\.DATABASE_URL(?![A-Z0-9_])/);
  assert.match(helper, /timingSafeEqual\(actual, expected\)/);
  assert.match(helper, /SET LOCAL ROLE wetindey_presence_safety/);
  assert.match(helper, /SELECT public\.presence_run_retention_cleanup\(\)/);
  assert.match(helper, /connect\(\): Promise<unknown>/);
  assert.match(helper, /end\(\): Promise<unknown>/);
  assert.match(helper, /private, no-store, max-age=0/);
  assert.doesNotMatch(helper, /Content-Length/i);
  assert.doesNotMatch(helper, /console\./);

  assert.deepEqual(
    vercel.crons?.find((cron) => cron.path === "/api/internal/presence/retention-cleanup"),
    {
      path: "/api/internal/presence/retention-cleanup",
      schedule: "*/15 * * * *",
    }
  );
  assert.match(envExample, /^PRESENCE_SAFETY_DATABASE_URL_UNPOOLED=$/m);
});
