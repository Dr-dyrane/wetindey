import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createReportSubmissionCoordinator,
  type ReportSubmissionIntent,
} from "../../src/app/_components/report-price-sheet/hooks/useReportPriceSheet";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");
const ids = {
  placeId: "11111111-1111-4111-8111-111111111111",
  itemId: "22222222-2222-4222-8222-222222222222",
  variantId: "33333333-3333-4333-8333-333333333333",
  unitId: "44444444-4444-4444-8444-444444444444",
};
const uuid = (suffix: string) => `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${suffix}`;
const available = (price = "1250.678"): ReportSubmissionIntent => ({
  ...ids,
  price,
  available: "available",
});
const unavailable = (): ReportSubmissionIntent => ({
  ...ids,
  price: "9999",
  available: "unavailable",
});

function requestOf(
  coordinator: ReturnType<typeof createReportSubmissionCoordinator>,
  intent: ReportSubmissionIntent
) {
  const attempt = coordinator.start(intent);
  assert.equal(attempt.kind, "request");
  if (attempt.kind !== "request") throw new Error("expected request");
  return attempt.request;
}

test("coordinator constructs exact payloads and fingerprints the submitted kobo-normalized amount", () => {
  const coordinator = createReportSubmissionCoordinator(() => uuid("1"));
  const request = requestOf(coordinator, available());
  assert.deepEqual(request, {
    idempotencyKey: uuid("1"),
    itemVariantId: ids.variantId,
    unitId: ids.unitId,
    placeId: ids.placeId,
    availabilityState: "available",
    priceAmount: 1250.68,
  });

  coordinator.resolve({
    code: "received_for_review",
    requestId: ids.placeId,
    observationId: ids.variantId,
    replayed: false,
  });
  const unavailableRequest = requestOf(coordinator, unavailable());
  assert.equal(unavailableRequest.availabilityState, "unavailable");
  assert.equal("priceAmount" in unavailableRequest, false);
});

test("coordinator reuses and replaces idempotency keys at the correct ownership boundaries", () => {
  let number = 0;
  const coordinator = createReportSubmissionCoordinator(() => uuid(String(++number)));
  const first = requestOf(coordinator, available("500"));
  assert.deepEqual(coordinator.start(available("500")), { kind: "blocked" });
  assert.equal(coordinator.reset(), false, "new report/reset is blocked in flight");
  assert.equal(coordinator.invalidate(), false, "dismiss/input reset is blocked in flight");

  assert.deepEqual(coordinator.transport(), { phase: "error", code: "transport" });
  const retry = requestOf(coordinator, available("500"));
  assert.equal(retry.idempotencyKey, first.idempotencyKey, "transport retry reuses the same key");

  coordinator.resolve({ code: "maintenance" });
  const changed = requestOf(coordinator, available("501"));
  assert.notEqual(changed.idempotencyKey, first.idempotencyKey, "changed intent gets a fresh key");

  coordinator.resolve({ code: "idempotency_conflict", requestId: ids.unitId });
  const afterConflict = requestOf(coordinator, available("501"));
  assert.notEqual(afterConflict.idempotencyKey, changed.idempotencyKey, "conflict gets a fresh key");
});

test("coordinator maps every server result and rejects incomplete or out-of-range client intents", () => {
  const outcomes = [
    { result: { code: "maintenance" } as const, expected: { phase: "error", code: "maintenance" } },
    { result: { code: "invalid_input" } as const, expected: { phase: "error", code: "invalid_input" } },
    { result: { code: "reporting_disabled", requestId: ids.placeId } as const, expected: { phase: "error", code: "reporting_disabled" } },
    { result: { code: "rate_limited", requestId: ids.placeId, retryAfterSeconds: 90 } as const, expected: { phase: "error", code: "rate_limited", retryAfterSeconds: 90 } },
    { result: { code: "idempotency_conflict", requestId: ids.placeId } as const, expected: { phase: "error", code: "idempotency_conflict" } },
    { result: { code: "received_for_review", requestId: ids.placeId, observationId: ids.variantId, replayed: true } as const, expected: { phase: "success", replayed: true } },
  ];

  for (const { result, expected } of outcomes) {
    const coordinator = createReportSubmissionCoordinator(() => uuid("9"));
    requestOf(coordinator, available());
    assert.deepEqual(coordinator.resolve(result), expected);
  }

  const coordinator = createReportSubmissionCoordinator(() => uuid("8"));
  assert.deepEqual(coordinator.start({ ...available(), price: "4.99" }), {
    kind: "error",
    state: { phase: "error", code: "client_price" },
  });
  assert.deepEqual(coordinator.start({ ...available(), placeId: "not-an-id" }), {
    kind: "error",
    state: { phase: "error", code: "client_required" },
  });
});

test("controller uses the existing server action and the view keeps errors caution/neutral", async () => {
  const [controller, action, view, strings, changed] = await Promise.all([
    read("src/app/_components/report-price-sheet/ReportPriceSheet.tsx"),
    read("src/app/_actions/report-actions.ts"),
    read("src/app/_components/report-price-sheet/views/ReportPriceSheetView.tsx"),
    read("src/core/i18n/strings.ts"),
    Promise.resolve(
      execFileSync(
        "git",
        ["diff", "--name-only", "0ff3cea", "--", "src/app/_components/confirm-visit-sheet"],
        { cwd: new URL("../../", import.meta.url), encoding: "utf8" }
      )
    ),
  ]);

  assert.match(controller, /import \{ submitObservation \} from "@\/app\/_actions\/report-actions"/);
  assert.match(action, /^"use server";/);
  assert.match(view, /kind: "caution" as const/);
  assert.doesNotMatch(view, /<div role="status"[^>]*mx-4/);
  for (const key of ["report.choose_market", "report.choose_item", "report.choose_quality", "report.pick_item_first", "report.choose_unit"]) {
    assert.match(view, new RegExp(`p\\.t\\["${key.replace(".", "\\.")}"\\]`));
  }
  assert.match(strings, /"contribution\.received_body": "Waiting for review\."/);
  assert.doesNotMatch(strings, /"contribution\.received[^\n]*": "[^"\n]*(?:public|approved)/i);
  assert.equal(changed.trim(), "", "Visit Confirmation must remain unchanged from 0ff3cea");
});
