/**
 * Harness note: the module under test begins with `import "server-only"`,
 * which throws outside a react-server condition. Rather than weakening the
 * import, this file re-executes itself under `--conditions react-server`
 * (where server-only resolves to its no-op build) when the condition is not
 * already active, so a plain `npx tsx <this file>` works everywhere.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

if (!process.env.WETINDEY_RSC_REEXEC) {
  const cliRequire = createRequire(import.meta.url);
  const result = spawnSync(
    process.execPath,
    [cliRequire.resolve("tsx/cli"), "--conditions", "react-server", process.argv[1]],
    { stdio: "inherit", env: { ...process.env, WETINDEY_RSC_REEXEC: "1" } },
  );
  process.exit(result.status ?? 1);
}

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";


const actor = "11111111-1111-4111-8111-111111111111";
const observation = "22222222-2222-4222-8222-222222222222";
const request = "33333333-3333-4333-8333-333333333333";
const environment = {
  CONTRIBUTION_MODERATION_UI_ENABLED: "true",
  CONTRIBUTION_MODERATION_RELEASE: "0015:moderation-operations-v1",
  CONTRIBUTION_MODERATOR_DATABASE_URL_UNPOOLED: "postgres://moderator:secret@example.invalid/moderator",
};

async function main() {
  // Deferred imports: the runtime module begins with `import "server-only"`,
  // which must only ever load in the re-executed child where the
  // react-server condition resolves it to a no-op. A static import would be
  // hoisted above the re-exec guard by the CJS transform and throw.
  const {
    loadModerationQueue, loadModerationReview, moderateContribution, MODERATION_REASON_CODES, moderationRuntimeForContract,
  } = await import("../../src/lib/contributions/moderation-runtime");
  const { executeModerationCommand, ModerationCommandCoordinator, settleModerationRead } = await import(
    "../../src/app/operations/contributions/_components/hooks/useModerationConsole"
  );

  const operationRoot = fileURLToPath(
    new URL("../../src/app/operations/contributions", import.meta.url)
  );
  const sourcePaths = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory()
        ? sourcePaths(path)
        : /\.(?:ts|tsx)$/.test(entry.name)
          ? [path]
          : [];
    });
  for (const path of sourcePaths(operationRoot)) {
    const source = readFileSync(path, "utf8");
    if (!/^\s*["']use client["'];/u.test(source)) continue;
    assert.doesNotMatch(
      source,
      /(?:from\s+|import\s*\()\s*["'][^"']*moderation-runtime["']/u,
      `client module ${path} must not import the PostgreSQL-backed server runtime`
    );
  }
  const clientHook = readFileSync(
    `${operationRoot}/_components/hooks/useModerationConsole.ts`,
    "utf8"
  );
  const serverActions = readFileSync(`${operationRoot}/actions.ts`, "utf8");
  const serverRuntime = readFileSync(
    new URL("../../src/lib/contributions/moderation-runtime.ts", import.meta.url),
    "utf8"
  );
  assert.match(clientHook, /@\/lib\/contributions\/moderation-contract/);
  assert.match(serverActions, /^\s*["']use server["'];/u);
  assert.match(serverRuntime, /^import ["']server-only["'];/u);

  let effects = 0;
  const disabled = await loadModerationQueue({
    environment: {},
    createExecutor: () => { effects += 1; throw new Error("must not run"); },
    readActorId: async () => { effects += 1; return actor; },
  });
  assert.deepEqual(disabled, { code: "unavailable" });
  assert.equal(effects, 0, "disabled configuration must precede pool, SQL, and auth");

  const signedOut = await loadModerationQueue({
    environment,
    createExecutor: () => { throw new Error("signed-out callers must not open the pool"); },
    readActorId: async () => null,
  });
  assert.deepEqual(signedOut, { code: "session_expired" });
  const forbidden = await loadModerationQueue({
    environment,
    createExecutor: () => ({ query: async () => ({ rows: [{ rpc_access: true, moderator_member: false }] }) }),
    readActorId: async () => actor,
  });
  assert.deepEqual(forbidden, { code: "forbidden" });

  const statements: string[] = [];
  const ready = await loadModerationQueue({
    environment,
    createExecutor: () => ({
      query: async (statement) => {
        statements.push(statement);
        if (statement === moderationRuntimeForContract.CAPABILITY_SQL) {
          return { rows: [{ rpc_access: true, moderator_member: true }] };
        }
        return { rows: [{ observation_id: observation, availability_state: "available", price_amount: 12345, observed_at: "2026-07-21T00:00:00.000Z", submitted_at: "2026-07-21T01:00:00.000Z", collection_method: "manual", corrects_observation_id: null, attributed: true, source_id: "must-not-escape", request_id: "must-not-escape" }] };
      },
    }),
    readActorId: async () => actor,
  });
  assert.equal(ready.code, "ready");
  if (ready.code === "ready") {
    assert.deepEqual(Object.keys(ready.value[0]).sort(), ["attributed", "availabilityState", "collectionMethod", "correctsPriorEvidence", "observationId", "observedAt", "priceAmountKobo", "submittedAt"].sort());
  }
  assert.equal(statements.length, 2);

  const review = await loadModerationReview(observation, {
    environment,
    createExecutor: () => ({
      query: async (statement) => {
        if (statement === moderationRuntimeForContract.CAPABILITY_SQL) return { rows: [{ rpc_access: true, moderator_member: true }] };
        if (statement.includes("contribution_review_detail")) {
          return { rows: [{ observation_id: observation, item_id: "must-not-escape", item_label: "Rice", item_variant_id: "must-not-escape", variant_label: "50kg", unit_id: "must-not-escape", unit_label: "bag", place_id: "must-not-escape", place_label: "Festac Market", availability_state: "available", price_amount: 12345, observed_at: "2026-07-21T00:00:00.000Z", submitted_at: "2026-07-21T01:00:00.000Z", collection_method: "manual", corrects_observation_id: null, attributed: false, has_decision_history: true, reopened_after_reversal: true, effective_decision_id: request, actor_made_effective_decision: false, request_id: "must-not-escape" }] };
        }
        return { rows: [{ action: "moderation_approved", actor_account_id: actor, reason_code: "evidence_sufficient", created_at: "2026-07-21T02:00:00.000Z", details: { request_id: "must-not-escape" } }] };
      },
    }),
    readActorId: async () => actor,
  });
  assert.equal(review.code, "ready");
  if (review.code === "ready") {
    assert.equal(review.value.detail.canReverse, true, "a different moderator may reverse the effective decision");
    assert.equal(review.value.detail.activeDecisionId, request);
    assert.equal(review.value.detail.hasDecisionHistory, true);
    assert.equal(review.value.detail.reopenedAfterReversal, true);
    assert.deepEqual(Object.keys(review.value.detail).sort(), ["activeDecisionId", "attributed", "availabilityState", "canReverse", "collectionMethod", "correctsPriorEvidence", "hasDecisionHistory", "itemLabel", "observationId", "observedAt", "placeLabel", "priceAmountKobo", "reopenedAfterReversal", "submittedAt", "unitLabel", "variantLabel"].sort());
    assert.deepEqual(review.value.audit[0], { action: "approved", actor: "you", reasonCode: "evidence_sufficient", createdAt: "2026-07-21T02:00:00.000Z" });
  }

  const commandCalls: unknown[][] = [];
  const moderated = await moderateContribution(
    { requestId: request, observationId: observation, decision: "approve", reasonCode: "evidence_sufficient", priorDecisionId: null },
    {
      environment,
      createExecutor: () => ({
        query: async (statement, values) => {
          commandCalls.push([...values]);
          if (statement === moderationRuntimeForContract.CAPABILITY_SQL) return { rows: [{ rpc_access: true, moderator_member: true }] };
          return { rows: [{ projection_state: "available", replayed: false }] };
        },
      }),
      readActorId: async () => actor,
    }
  );
  assert.deepEqual(moderated, { code: "ready", value: { projectionState: "available" } });
  assert.equal(commandCalls.length, 2);

  const coordinator = new ModerationCommandCoordinator();
  const first = coordinator.begin("same");
  assert.ok(first);
  assert.equal(coordinator.begin("same"), null, "double tap must not start a second mutation");
  coordinator.finish();
  assert.equal(coordinator.begin("same"), first, "unchanged retry must reuse request identity");
  coordinator.finish();
  assert.notEqual(coordinator.begin("changed"), first, "changed intent must receive a new request identity");

  const retryCoordinator = new ModerationCommandCoordinator();
  const transportId = retryCoordinator.begin("transport");
  retryCoordinator.finish();
  await assert.rejects(
    executeModerationCommand(retryCoordinator, "transport", async () => { throw new Error("transport failed"); }),
    /transport failed/
  );
  assert.equal(retryCoordinator.begin("transport"), transportId, "same-attempt transport retry retains its request identity after cleanup");
  retryCoordinator.finish();

  const conflictCoordinator = new ModerationCommandCoordinator();
  let conflictedRequestId: string | null = null;
  const conflicted = await executeModerationCommand(conflictCoordinator, "conflict", async (requestId) => {
    conflictedRequestId = requestId;
    return { code: "conflict" };
  });
  assert.deepEqual(conflicted, { code: "conflict" });
  const afterConflict = conflictCoordinator.begin("conflict");
  assert.notEqual(afterConflict, null);
  assert.notEqual(afterConflict, conflictedRequestId, "idempotency conflict clears the old request identity");

  let queueReadState = "loading";
  await settleModerationRead(async () => { throw new Error("queue transport failed"); }, () => { queueReadState = "ready"; }, () => { queueReadState = "unavailable"; });
  assert.equal(queueReadState, "unavailable", "a rejected queue read must leave loading deterministically");
  let detailReadState = "loading";
  await settleModerationRead(async () => { throw new Error("detail transport failed"); }, () => { detailReadState = "ready"; }, () => { detailReadState = "unavailable"; });
  assert.equal(detailReadState, "unavailable", "a rejected detail read must leave loading deterministically");

  assert.deepEqual(moderationRuntimeForContract.RPC_SIGNATURES, [
    "public.contribution_pending_queue(uuid,integer)",
    "public.contribution_review_detail(uuid,uuid)",
    "public.contribution_moderate(uuid,uuid,text,uuid,public.contribution_decision,text,uuid)",
    "public.contribution_audit_for_observation(uuid,uuid,integer)",
  ]);
  assert.match(moderationRuntimeForContract.CAPABILITY_SQL, /pg_catalog\.to_regprocedure/);
  assert.match(moderationRuntimeForContract.CAPABILITY_SQL, /pg_catalog\.pg_has_role/);
  assert.equal(moderationRuntimeForContract.isReasonCode("approve", "evidence_sufficient"), true);
  assert.equal(moderationRuntimeForContract.isReasonCode("approve", "decision_error"), false);
  assert.deepEqual(MODERATION_REASON_CODES.reverse, ["new_evidence", "decision_error"]);
  console.log("Contribution moderation runtime contracts satisfied.");
}

void main();
