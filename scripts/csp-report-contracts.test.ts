import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CSP_REPORT_LIMITS,
  CspReportInputError,
  handleCspReportPost,
  parseAndSanitizeCspReportText,
  redactCspReport,
  type SanitizedCspReport,
} from "../src/lib/security/csp-report";
import {
  CSP_AGGREGATE_CLOSE_DELAY_DAYS,
  CSP_REPORT_NAMESPACES,
  createCspReportStore,
  isAuthorizedCronRequest,
  type CspReportBlobClient,
} from "../src/lib/security/csp-report-store";

interface FakeBlob {
  body: string;
  pathname: string;
  uploadedAt: Date;
}

class FakeBlobClient implements CspReportBlobClient {
  readonly blobs = new Map<string, FakeBlob>();
  readonly putOptions: Array<{
    access: string;
    token: string;
  }> = [];
  listCalls = 0;
  now = new Date("2026-07-18T12:00:00.000Z");

  async put(
    pathname: string,
    body: string,
    options: {
      access: "private";
      token: string;
      contentType: "application/json";
      addRandomSuffix: false;
      allowOverwrite: boolean;
    }
  ): Promise<void> {
    this.putOptions.push({ access: options.access, token: options.token });
    if (this.blobs.has(pathname) && !options.allowOverwrite) {
      throw new Error("conflict");
    }
    this.blobs.set(pathname, {
      body,
      pathname,
      uploadedAt: this.now,
    });
  }

  async list(options: { prefix: string; cursor?: string; limit: number; token: string }) {
    this.listCalls += 1;
    const start = Number(options.cursor ?? "0");
    const all = [...this.blobs.values()]
      .filter((blob) => blob.pathname.startsWith(options.prefix))
      .sort((left, right) => left.pathname.localeCompare(right.pathname));
    const blobs = all.slice(start, start + 2).map((blob) => ({
      pathname: blob.pathname,
      url: `private-test:${blob.pathname}`,
      uploadedAt: blob.uploadedAt,
    }));
    const next = start + blobs.length;
    return {
      blobs,
      hasMore: next < all.length,
      ...(next < all.length ? { cursor: String(next) } : {}),
    };
  }

  async getText(pathname: string, _token: string): Promise<string | null> {
    return this.blobs.get(pathname)?.body ?? null;
  }

  async delete(pathnames: string[], _token: string): Promise<void> {
    for (const pathname of pathnames) this.blobs.delete(pathname);
  }

  seed(pathname: string, body: unknown, uploadedAt: Date): void {
    this.blobs.set(pathname, {
      pathname,
      body: `${JSON.stringify(body)}\n`,
      uploadedAt,
    });
  }
}

const NOW = new Date("2026-07-18T12:00:00.000Z");

function legacyPayload(): string {
  return JSON.stringify({
    "csp-report": {
      "document-uri": "https://user:password@www.wetindey.live/private/object?token=secret#person",
      "blocked-uri":
        "https://private-store-id.person-token.private.blob.vercel-storage.com/private/key?signature=secret#object",
      "source-file": "https://www.wetindey.live/_next/private.js?id=person#sample",
      "effective-directive": "script-src-elem",
      "violated-directive": "script-src-elem",
      "status-code": 200,
      "line-number": 42,
      "column-number": 7,
      "script-sample": "secret-token-and-identifier",
      identifier: "person@example.test",
      token: "must-not-survive",
    },
  });
}

function sanitizedReport(day: string): SanitizedCspReport {
  return {
    receivedAt: `${day}T12:00:00.000Z`,
    disposition: "report",
    effectiveDirective: "script-src-elem",
    violatedDirective: "script-src-elem",
    blockedResource: {
      kind: "unknown-third-party",
    },
    documentClass: "first-party",
    statusCode: 200,
  };
}

async function run(): Promise<void> {
  const reports = parseAndSanitizeCspReportText(legacyPayload(), "application/csp-report", NOW);
  assert.equal(reports.length, 1);
  const serialized = JSON.stringify(reports);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("private/object"), false);
  assert.equal(serialized.includes("person"), false);
  assert.equal(serialized.includes("signature"), false);
  assert.equal(reports[0]?.documentClass, "first-party");
  assert.equal(reports[0]?.blockedResource.kind, "vercel-blob");
  assert.equal(serialized.includes("private-store-id"), false);
  assert.deepEqual(redactCspReport(reports[0]!), {
    receivedDay: "2026-07-18",
    disposition: "unknown",
    effectiveDirective: "script-src-elem",
    violatedDirective: "script-src-elem",
    blockedKind: "vercel-blob",
    statusClass: 2,
  });
  const hostileDirective = parseAndSanitizeCspReportText(
    JSON.stringify({
      "csp-report": {
        "document-uri": "https://www.wetindey.live",
        "blocked-uri": "inline",
        "effective-directive": "person-token-secret",
        "violated-directive": "store-identifier-secret",
      },
    }),
    "application/csp-report",
    NOW
  );
  assert.equal(hostileDirective[0]?.effectiveDirective, "unknown");
  assert.equal(hostileDirective[0]?.violatedDirective, "unknown");
  assert.equal(JSON.stringify(hostileDirective).includes("secret"), false);

  assert.throws(
    () =>
      parseAndSanitizeCspReportText(
        JSON.stringify(
          Array.from({ length: CSP_REPORT_LIMITS.maxBatch + 1 }, () => ({
            type: "csp-violation",
            body: {},
          }))
        ),
        "application/reports+json",
        NOW
      ),
    CspReportInputError
  );
  const deep = { value: "end" } as Record<string, unknown>;
  let cursor = deep;
  for (let index = 0; index <= CSP_REPORT_LIMITS.maxDepth; index += 1) {
    cursor.child = {};
    cursor = cursor.child as Record<string, unknown>;
  }
  assert.throws(
    () =>
      parseAndSanitizeCspReportText(
        JSON.stringify({ "csp-report": deep }),
        "application/csp-report",
        NOW
      ),
    CspReportInputError
  );

  let persisted = 0;
  let persistedJson = "";
  const response = await handleCspReportPost(
    new Request("https://www.wetindey.live/reports/security/csp", {
      method: "POST",
      headers: {
        "content-type": "application/csp-report",
        cookie: "must-not-be-read",
        authorization: "must-not-be-read",
        "x-forwarded-for": "must-not-be-read",
      },
      body: legacyPayload(),
    }),
    async (value) => {
      persisted += value.length;
      persistedJson = JSON.stringify(value);
    },
    NOW
  );
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(persisted, 1);
  assert.equal(persistedJson.includes("must-not-be-read"), false);

  const failedStorage = await handleCspReportPost(
    new Request("https://www.wetindey.live/reports/security/csp", {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: legacyPayload(),
    }),
    async () => {
      throw new Error("private provider detail");
    },
    NOW
  );
  assert.equal(failedStorage.status, 204);
  assert.equal(await failedStorage.text(), "");

  const oversized = await handleCspReportPost(
    new Request("https://www.wetindey.live/reports/security/csp", {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: "x".repeat(CSP_REPORT_LIMITS.maxBytes + 1),
    }),
    async () => {
      throw new Error("must not persist");
    },
    NOW
  );
  assert.equal(oversized.status, 413);
  assert.equal(await oversized.text(), "");

  const fake = new FakeBlobClient();
  const token = "test-private-token";
  const store = createCspReportStore({
    token,
    client: fake,
    now: () => NOW,
    eventKey: () => "local-event-key",
  });
  await store.persist([sanitizedReport("2026-07-18")]);
  assert.equal(fake.blobs.size, 2);
  assert.equal(
    fake.putOptions.every((options) => options.access === "private" && options.token === token),
    true
  );

  const oldRaw = `${CSP_REPORT_NAMESPACES.raw}2026-07-01/old.json`;
  const recentRaw = `${CSP_REPORT_NAMESPACES.raw}2026-07-17/recent.json`;
  const oldRedacted = `${CSP_REPORT_NAMESPACES.redacted}2026-06-01/old.json`;
  const recentRedacted = `${CSP_REPORT_NAMESPACES.redacted}2026-07-17/recent.json`;
  const oldAggregate = `${CSP_REPORT_NAMESPACES.aggregate}2026-03-01.json`;
  fake.seed(oldRaw, sanitizedReport("2026-07-01"), new Date("2026-07-01"));
  fake.seed(recentRaw, sanitizedReport("2026-07-17"), new Date("2026-07-17"));
  fake.seed(oldRedacted, redactCspReport(sanitizedReport("2026-06-01")), new Date("2026-06-01"));
  fake.seed(recentRedacted, redactCspReport(sanitizedReport("2026-07-17")), new Date("2026-07-17"));
  fake.seed(oldAggregate, { day: "2026-03-01", rows: [], total: 0 }, new Date("2026-03-01"));

  const cleanup = await store.cleanup();
  assert.equal(cleanup.deleted.raw, 1);
  assert.equal(cleanup.deleted.redacted, 1);
  assert.equal(cleanup.deleted.aggregate, 1);
  assert.equal(cleanup.aggregatedDays >= 1, true);
  assert.equal(fake.blobs.has(oldRaw), false);
  assert.equal(fake.blobs.has(recentRaw), true);
  assert.equal(fake.blobs.has(oldRedacted), false);
  assert.equal(fake.blobs.has(recentRedacted), true);
  assert.equal(fake.blobs.has(oldAggregate), false);
  assert.equal(fake.listCalls > 3, true);

  const aggregateBodies = [...fake.blobs.values()]
    .filter((blob) => blob.pathname.startsWith(CSP_REPORT_NAMESPACES.aggregate))
    .map((blob) => blob.body);
  assert.equal(aggregateBodies.length >= 1, true);
  assert.equal(
    aggregateBodies.some((body) => body.includes("https://")),
    false
  );
  const secondCleanup = await store.cleanup();
  assert.deepEqual(secondCleanup.deleted, {
    raw: 0,
    redacted: 0,
    aggregate: 0,
  });
  assert.equal(secondCleanup.aggregatedDays, 0);

  assert.equal(CSP_AGGREGATE_CLOSE_DELAY_DAYS, 1);
  let raceNow = new Date("2026-07-18T00:05:00.000Z");
  const raceFake = new FakeBlobClient();
  const raceStore = createCspReportStore({
    token,
    client: raceFake,
    now: () => raceNow,
    eventKey: () => "race-event",
  });
  const raceDay = "2026-07-17";
  const firstRacePath = `${CSP_REPORT_NAMESPACES.redacted}${raceDay}/first.json`;
  const lateRacePath = `${CSP_REPORT_NAMESPACES.redacted}${raceDay}/late.json`;
  raceFake.seed(
    firstRacePath,
    redactCspReport(sanitizedReport(raceDay)),
    new Date("2026-07-17T23:59:00.000Z")
  );
  const openDayCleanup = await raceStore.cleanup();
  assert.equal(openDayCleanup.aggregatedDays, 0);
  raceFake.seed(
    lateRacePath,
    redactCspReport(sanitizedReport(raceDay)),
    new Date("2026-07-18T00:06:00.000Z")
  );
  raceNow = new Date("2026-07-19T00:06:00.000Z");
  raceFake.now = raceNow;
  const closedDayCleanup = await raceStore.cleanup();
  assert.equal(closedDayCleanup.aggregatedDays, 1);
  const raceAggregate = raceFake.blobs.get(`${CSP_REPORT_NAMESPACES.aggregate}${raceDay}.json`);
  assert.equal(JSON.parse(raceAggregate?.body ?? "{}").total, 2);
  const repeatedRaceCleanup = await raceStore.cleanup();
  assert.equal(repeatedRaceCleanup.aggregatedDays, 0);
  assert.equal(JSON.parse(raceAggregate?.body ?? "{}").total, 2);

  assert.equal(isAuthorizedCronRequest("Bearer cron-test", "cron-test"), true);
  assert.equal(isAuthorizedCronRequest("Bearer wrong", "cron-test"), false);
  assert.equal(isAuthorizedCronRequest(null, "cron-test"), false);
  assert.equal(isAuthorizedCronRequest("Bearer cron-test", ""), false);

  const publicRoute = await readFile(
    new URL("../src/app/reports/security/csp/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(publicRoute, /export async function POST/);
  assert.doesNotMatch(publicRoute, /export async function GET/);
  assert.doesNotMatch(publicRoute, /cookies\(|authorization|x-forwarded-for|request\.text\(/i);

  process.stdout.write("csp-report-contracts: PASS\n");
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown failure";
  process.stderr.write(`csp-report-contracts: FAIL (${message})\n`);
  process.exitCode = 1;
});
