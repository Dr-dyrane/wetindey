import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  admitFoodContribution,
  type ContributionQueryExecutor,
  type ContributionRuntimeDependencies,
} from "../../src/lib/contributions/runtime";
import { parseContributionAdmission } from "../../src/lib/validation";

const repoRoot = new URL("../../", import.meta.url);
const release =
  "0013:052769850c3d633230d9ec109c2b09067b73a686cadb7c139a613622184f0f0a";
const ids = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  itemVariantId: "22222222-2222-4222-8222-222222222222",
  unitId: "33333333-3333-4333-8333-333333333333",
  placeId: "44444444-4444-4444-8444-444444444444",
  requestId: "55555555-5555-4555-8555-555555555555",
  observationId: "66666666-6666-4666-8666-666666666666",
};

function enabledEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    CONTRIBUTION_ADMISSION_ENABLED: "true",
    CONTRIBUTION_ADMISSION_RELEASE: release,
    CONTRIBUTION_RUNTIME_DATABASE_URL_UNPOOLED:
      "postgresql://contribution-runtime",
    CONTRIBUTION_HMAC_SECRET: "s".repeat(32),
    CONTRIBUTION_TRUSTED_NETWORK_HEADER: "x-vercel-forwarded-for",
    DATABASE_URL: "postgresql://owner-must-never-be-used",
  };
}

function capabilityRow(): Record<string, unknown> {
  return { can_execute: true, runtime_member: true };
}

function dependencies(options?: {
  environment?: NodeJS.ProcessEnv;
  query?: (
    statement: string,
    values: unknown[],
    index: number
  ) => Promise<{ rows: unknown[] }>;
  events?: string[];
  actorId?: string | null;
  trustedNetwork?: string | null;
  now?: Date;
}): ContributionRuntimeDependencies {
  const events = options?.events ?? [];
  let queryIndex = 0;
  return {
    environment: options?.environment ?? enabledEnvironment(),
    createExecutor: (connectionString) => {
      events.push(`pool:${connectionString}`);
      return {
        query: async (statement, values) => {
          const currentIndex = queryIndex++;
          events.push(`sql:${currentIndex}`);
          if (options?.query) {
            return options.query(statement, values, currentIndex);
          }
          return {
            rows:
              currentIndex === 0
                ? [capabilityRow()]
                : [
                    {
                      request_id: ids.requestId,
                      observation_id: ids.observationId,
                      result_code: "pending_review",
                      replayed: false,
                      retry_after_seconds: null,
                    },
                  ],
          };
        },
      } satisfies ContributionQueryExecutor;
    },
    parseInput: (data) => {
      events.push("validation");
      return parseContributionAdmission(data);
    },
    readActorId: async () => {
      events.push("auth");
      return options?.actorId ?? null;
    },
    readTrustedNetwork: async (headerName) => {
      events.push(`header:${headerName}`);
      return options?.trustedNetwork === undefined
        ? "198.51.100.42"
        : options.trustedNetwork;
    },
    readAnonymousSubject: async () => {
      events.push("anonymous-subject");
      return "77777777-7777-4777-8777-777777777777";
    },
    now: () => options?.now ?? new Date("2026-07-18T12:00:00.000Z"),
  };
}

const available = {
  idempotencyKey: ids.idempotencyKey,
  itemVariantId: ids.itemVariantId,
  unitId: ids.unitId,
  placeId: ids.placeId,
  availabilityState: "available" as const,
  priceAmount: 1_250,
};

test("release/configuration gate precedes every request, identity and SQL effect", async () => {
  for (const environment of [
    { NODE_ENV: "test" as const },
    { ...enabledEnvironment(), CONTRIBUTION_ADMISSION_ENABLED: "false" },
    { ...enabledEnvironment(), CONTRIBUTION_ADMISSION_RELEASE: "0013:wrong" },
    {
      ...enabledEnvironment(),
      CONTRIBUTION_RUNTIME_DATABASE_URL_UNPOOLED: undefined,
    },
    { ...enabledEnvironment(), CONTRIBUTION_HMAC_SECRET: "too-short" },
    {
      ...enabledEnvironment(),
      CONTRIBUTION_TRUSTED_NETWORK_HEADER: "x-forwarded-for",
    },
  ]) {
    const events: string[] = [];
    assert.deepEqual(
      await admitFoodContribution(
        available,
        dependencies({ environment, events })
      ),
      { code: "maintenance" }
    );
    assert.deepEqual(events, []);
  }
});

test("exact capability and EXECUTE probe precedes validation, auth and headers", async () => {
  for (const rows of [
    [],
    [{ can_execute: false, runtime_member: true }],
    [{ can_execute: true, runtime_member: false }],
    [capabilityRow(), capabilityRow()],
  ]) {
    const events: string[] = [];
    const result = await admitFoodContribution(
      available,
      dependencies({
        events,
        query: async (_statement, _values, index) => ({
          rows: index === 0 ? rows : assert.fail("admission RPC was reached"),
        }),
      })
    );
    assert.deepEqual(result, { code: "maintenance" });
    assert.deepEqual(events, [
      "pool:postgresql://contribution-runtime",
      "sql:0",
    ]);
  }
});

test("strict validation rejects unavailable-with-price before identity or RPC", async () => {
  const events: string[] = [];
  const result = await admitFoodContribution(
    {
      idempotencyKey: ids.idempotencyKey,
      itemVariantId: ids.itemVariantId,
      unitId: ids.unitId,
      placeId: ids.placeId,
      availabilityState: "unavailable",
      priceAmount: 1_250,
    },
    dependencies({ events })
  );
  assert.deepEqual(result, { code: "invalid_input" });
  assert.deepEqual(events, [
    "pool:postgresql://contribution-runtime",
    "sql:0",
    "validation",
  ]);
});

test("admission uses only the exact RPC with server-derived digests and kobo", async () => {
  const statements: Array<{ statement: string; values: unknown[] }> = [];
  const result = await admitFoodContribution(
    available,
    dependencies({
      query: async (statement, values, index) => {
        statements.push({ statement, values });
        if (index === 0) return { rows: [capabilityRow()] };
        return {
          rows: [
            {
              request_id: ids.requestId,
              observation_id: ids.observationId,
              result_code: "pending_review",
              replayed: false,
              retry_after_seconds: null,
            },
          ],
        };
      },
    })
  );

  assert.deepEqual(result, {
    code: "received_for_review",
    requestId: ids.requestId,
    observationId: ids.observationId,
    replayed: false,
  });
  assert.equal(statements.length, 2);
  assert.match(statements[0].statement, /pg_catalog\.pg_proc/);
  assert.match(statements[0].statement, /has_function_privilege/);
  assert.match(statements[0].statement, /pg_has_role/);
  assert.match(
    statements[1].statement,
    /FROM public\.contribution_admit\(/
  );
  assert.doesNotMatch(
    statements[1].statement,
    /\b(?:INSERT|UPDATE|DELETE|offers_current|observations)\b/i
  );
  assert.equal(statements[1].values[0], "report_price");
  assert.equal(statements[1].values[1], ids.idempotencyKey);
  assert.match(String(statements[1].values[2]), /^[0-9a-f]{64}$/);
  assert.match(String(statements[1].values[3]), /^[0-9a-f]{64}$/);
  assert.match(String(statements[1].values[4]), /^[0-9a-f]{64}$/);
  assert.equal(statements[1].values[5], null);
  assert.equal(statements[1].values[10], 125_000);
  assert.equal(statements[1].values[11], "2026-07-18T12:00:00.000");
  assert.equal(statements[1].values[12], null);
  assert.equal(statements[1].values[13], null);
  assert.equal(
    statements.flatMap(({ values }) => values).includes("198.51.100.42"),
    false
  );
});

test("unavailable sends no price and default-off remains truthful", async () => {
  let rpcValues: unknown[] = [];
  const result = await admitFoodContribution(
    {
      idempotencyKey: ids.idempotencyKey,
      itemVariantId: ids.itemVariantId,
      unitId: ids.unitId,
      placeId: ids.placeId,
      availabilityState: "unavailable",
    },
    dependencies({
      query: async (_statement, values, index) => {
        if (index === 0) return { rows: [capabilityRow()] };
        rpcValues = values;
        return {
          rows: [
            {
              request_id: ids.requestId,
              observation_id: null,
              result_code: "reporting_disabled",
              replayed: false,
              retry_after_seconds: null,
            },
          ],
        };
      },
    })
  );
  assert.deepEqual(result, {
    code: "reporting_disabled",
    requestId: ids.requestId,
  });
  assert.equal(rpcValues[9], "unavailable");
  assert.equal(rpcValues[10], null);
});

test("session attribution is server-derived and missing trusted network fails closed", async () => {
  const actorId = "88888888-8888-4888-8888-888888888888";
  let signedInValues: unknown[] = [];
  const signedIn = await admitFoodContribution(
    available,
    dependencies({
      actorId,
      query: async (_statement, values, index) => {
        if (index === 0) return { rows: [capabilityRow()] };
        signedInValues = values;
        return {
          rows: [
            {
              request_id: ids.requestId,
              observation_id: ids.observationId,
              result_code: "pending_review",
              replayed: false,
              retry_after_seconds: null,
            },
          ],
        };
      },
    })
  );
  assert.equal(signedIn.code, "received_for_review");
  assert.equal(signedInValues[5], actorId);

  const events: string[] = [];
  assert.deepEqual(
    await admitFoodContribution(
      available,
      dependencies({ events, trustedNetwork: null })
    ),
    { code: "maintenance" }
  );
  assert.deepEqual(events, [
    "pool:postgresql://contribution-runtime",
    "sql:0",
    "validation",
    "auth",
    "header:x-vercel-forwarded-for",
  ]);
});

test("idempotency payload digest is stable across server observation times", async () => {
  const payloadDigests: string[] = [];
  for (const now of [
    new Date("2026-07-18T12:00:00.000Z"),
    new Date("2026-07-18T12:04:59.000Z"),
  ]) {
    await admitFoodContribution(
      available,
      dependencies({
        now,
        query: async (_statement, values, index) => {
          if (index === 0) return { rows: [capabilityRow()] };
          payloadDigests.push(String(values[4]));
          return {
            rows: [
              {
                request_id: ids.requestId,
                observation_id: ids.observationId,
                result_code: "pending_review",
                replayed: index > 1,
                retry_after_seconds: null,
              },
            ],
          };
        },
      })
    );
  }
  assert.equal(payloadDigests.length, 2);
  assert.equal(payloadDigests[0], payloadDigests[1]);
});

test("stable RPC outcomes expose no publication promise", async () => {
  const cases = [
    {
      row: {
        request_id: ids.requestId,
        observation_id: null,
        result_code: "rate_limited",
        replayed: false,
        retry_after_seconds: 73,
      },
      expected: {
        code: "rate_limited",
        requestId: ids.requestId,
        retryAfterSeconds: 73,
      },
    },
    {
      row: {
        request_id: ids.requestId,
        observation_id: null,
        result_code: "idempotency_conflict",
        replayed: false,
        retry_after_seconds: null,
      },
      expected: { code: "idempotency_conflict", requestId: ids.requestId },
    },
  ] as const;

  for (const { row, expected } of cases) {
    const result = await admitFoodContribution(
      available,
      dependencies({
        query: async (_statement, _values, index) => ({
          rows: index === 0 ? [capabilityRow()] : [row],
        }),
      })
    );
    assert.deepEqual(result, expected);
  }
});

test("source wiring keeps the live boundary RPC-only and promise-free", async () => {
  const actions = await readFile(
    new URL("src/app/actions.ts", repoRoot),
    "utf8"
  );
  const runtime = await readFile(
    new URL("src/lib/contributions/runtime.ts", repoRoot),
    "utf8"
  );
  const validation = await readFile(
    new URL("src/lib/validation.ts", repoRoot),
    "utf8"
  );
  const actionStart = actions.indexOf(
    "export async function submitObservation"
  );
  const boundaryEnd = actions.indexOf(
    "export async function getInitialSubmissionData",
    actionStart
  );
  const liveBoundary = actions.slice(actionStart, boundaryEnd);

  assert.match(liveBoundary, /return admitFoodContribution\(data\)/);
  assert.doesNotMatch(
    liveBoundary,
    /\b(?:db|observations|offersCurrent|contributorSourceId|queued|retry|published|saved|success)\b/
  );
  assert.doesNotMatch(runtime, /@\/db|DATABASE_URL(?![A-Z0-9_])|offers_current/);
  assert.doesNotMatch(
    runtime,
    /\b(?:INSERT|UPDATE|DELETE)\b|localStorage|pending_observations|pending_visit_confirmations/
  );
  assert.match(runtime, /const TRUSTED_NETWORK_HEADER = "x-vercel-forwarded-for"/);
  assert.match(runtime, /isIP\(value\) === 0/);
  assert.doesNotMatch(
    runtime,
    /TRUSTED_NETWORK_HEADER = "x-forwarded-for"/
  );
  const unavailableBranch = validation.slice(
    validation.indexOf('availabilityState: z.literal("unavailable")'),
    validation.indexOf(
      "]);",
      validation.indexOf('availabilityState: z.literal("unavailable")')
    )
  );
  assert.doesNotMatch(unavailableBranch, /priceAmount/);
});
