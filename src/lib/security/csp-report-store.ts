import { timingSafeEqual } from "node:crypto";
import { del as deleteBlob, get as getBlob, list as listBlobs, put as putBlob } from "@vercel/blob";
import { redactCspReport, type RedactedCspReport, type SanitizedCspReport } from "./csp-report";

const DAY_MS = 24 * 60 * 60 * 1_000;
const LIST_LIMIT = 1_000;
const DELETE_BATCH_SIZE = 100;

export const CSP_REPORT_RETENTION_DAYS = {
  raw: 14,
  redacted: 30,
  aggregate: 90,
} as const;

// Reports are server-stamped at persistence and daily aggregates remain open
// for a full additional day. This is longer than a request can remain active
// on the platform, so an immutable aggregate cannot race an in-flight write.
export const CSP_AGGREGATE_CLOSE_DELAY_DAYS = 1;

export const CSP_REPORT_NAMESPACES = {
  raw: "security-csp/raw/",
  redacted: "security-csp/redacted/",
  aggregate: "security-csp/aggregate/",
} as const;

interface BlobMetadata {
  url: string;
  pathname: string;
  uploadedAt: Date;
}

interface BlobListResult {
  blobs: BlobMetadata[];
  cursor?: string;
  hasMore: boolean;
}

interface PrivatePutOptions {
  access: "private";
  token: string;
  contentType: "application/json";
  addRandomSuffix: false;
  allowOverwrite: boolean;
}

export interface CspReportBlobClient {
  put(pathname: string, body: string, options: PrivatePutOptions): Promise<void>;
  list(options: {
    prefix: string;
    cursor?: string;
    limit: number;
    token: string;
  }): Promise<BlobListResult>;
  getText(pathname: string, token: string): Promise<string | null>;
  delete(pathnames: string[], token: string): Promise<void>;
}

const vercelBlobClient: CspReportBlobClient = {
  async put(pathname, body, options) {
    await putBlob(pathname, body, options);
  },
  async list(options) {
    const result = await listBlobs(options);
    return {
      blobs: result.blobs.map((blob) => ({
        url: blob.url,
        pathname: blob.pathname,
        uploadedAt: blob.uploadedAt,
      })),
      ...(result.cursor ? { cursor: result.cursor } : {}),
      hasMore: result.hasMore,
    };
  },
  async getText(pathname, token) {
    const result = await getBlob(pathname, { access: "private", token });
    return result ? new Response(result.stream).text() : null;
  },
  async delete(pathnames, token) {
    if (pathnames.length > 0) {
      await deleteBlob(pathnames, { token });
    }
  },
};

interface AggregateRow {
  disposition: RedactedCspReport["disposition"];
  effectiveDirective: string;
  violatedDirective?: string;
  blockedKind: RedactedCspReport["blockedKind"];
  statusClass?: number;
  count: number;
}

interface DailyAggregate {
  day: string;
  rows: AggregateRow[];
  total: number;
}

export interface CspReportCleanupResult {
  aggregatedDays: number;
  deleted: {
    raw: number;
    redacted: number;
    aggregate: number;
  };
}

function requiredValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function privateBlobTokenFromEnvironment(): string | null {
  return requiredValue(process.env.BLOB_READ_WRITE_TOKEN_PRIVATE);
}

export function cronSecretFromEnvironment(): string | null {
  return requiredValue(process.env.CRON_SECRET);
}

export function isAuthorizedCronRequest(authorization: string | null, secret: string): boolean {
  if (!authorization || !secret.trim()) return false;
  const actual = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
}

function json(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function aggregatePath(day: string): string {
  return `${CSP_REPORT_NAMESPACES.aggregate}${day}.json`;
}

function eventPath(
  namespace: typeof CSP_REPORT_NAMESPACES.raw | typeof CSP_REPORT_NAMESPACES.redacted,
  receivedAt: Date,
  eventKey: string
): string {
  return `${namespace}${dayOf(receivedAt)}/${eventKey}.json`;
}

function aggregateKey(report: RedactedCspReport): string {
  return JSON.stringify([
    report.disposition,
    report.effectiveDirective,
    report.violatedDirective ?? "",
    report.blockedKind,
    report.statusClass ?? null,
  ]);
}

function buildAggregate(day: string, reports: RedactedCspReport[]): DailyAggregate {
  const counts = new Map<string, { report: RedactedCspReport; count: number }>();
  for (const report of reports) {
    const key = aggregateKey(report);
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, { report, count: 1 });
    }
  }

  const rows = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, { report, count }]) => ({
      disposition: report.disposition,
      effectiveDirective: report.effectiveDirective,
      ...(report.violatedDirective ? { violatedDirective: report.violatedDirective } : {}),
      blockedKind: report.blockedKind,
      ...(report.statusClass !== undefined ? { statusClass: report.statusClass } : {}),
      count,
    }));

  return {
    day,
    rows,
    total: rows.reduce((sum, row) => sum + row.count, 0),
  };
}

function parseRedactedReport(text: string): RedactedCspReport | null {
  try {
    const value = JSON.parse(text) as unknown;
    if (value === null || Array.isArray(value) || typeof value !== "object") {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.receivedDay !== "string" ||
      typeof record.effectiveDirective !== "string" ||
      typeof record.blockedKind !== "string" ||
      (record.disposition !== "enforce" &&
        record.disposition !== "report" &&
        record.disposition !== "unknown")
    ) {
      return null;
    }
    return value as RedactedCspReport;
  } catch {
    return null;
  }
}

async function listAll(
  client: CspReportBlobClient,
  token: string,
  prefix: string
): Promise<BlobMetadata[]> {
  const blobs: BlobMetadata[] = [];
  let cursor: string | undefined;
  do {
    const result = await client.list({
      prefix,
      ...(cursor ? { cursor } : {}),
      limit: LIST_LIMIT,
      token,
    });
    blobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
    if (result.hasMore && !cursor) {
      throw new Error("Private Blob listing omitted its continuation cursor");
    }
  } while (cursor);
  return blobs;
}

async function deleteInBatches(
  client: CspReportBlobClient,
  token: string,
  pathnames: string[]
): Promise<void> {
  for (let index = 0; index < pathnames.length; index += DELETE_BATCH_SIZE) {
    await client.delete(pathnames.slice(index, index + DELETE_BATCH_SIZE), token);
  }
}

function olderThan(blob: BlobMetadata, now: Date, days: number): boolean {
  return blob.uploadedAt.getTime() <= now.getTime() - days * DAY_MS;
}

async function ensureCompletedDayAggregates(
  client: CspReportBlobClient,
  token: string,
  redacted: BlobMetadata[],
  existingAggregates: Set<string>,
  now: Date
): Promise<number> {
  const closedBeforeDay = dayOf(new Date(now.getTime() - CSP_AGGREGATE_CLOSE_DELAY_DAYS * DAY_MS));
  const byDay = new Map<string, BlobMetadata[]>();
  for (const blob of redacted) {
    const relative = blob.pathname.slice(CSP_REPORT_NAMESPACES.redacted.length);
    const day = relative.split("/", 1)[0] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day >= closedBeforeDay) continue;
    const entries = byDay.get(day) ?? [];
    entries.push(blob);
    byDay.set(day, entries);
  }

  let aggregatedDays = 0;
  for (const [day, blobs] of [...byDay.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const pathname = aggregatePath(day);
    if (existingAggregates.has(pathname)) continue;

    const reports: RedactedCspReport[] = [];
    for (const blob of blobs.sort((left, right) => left.pathname.localeCompare(right.pathname))) {
      const text = await client.getText(blob.pathname, token);
      if (text === null) continue;
      const report = parseRedactedReport(text);
      if (report) reports.push(report);
    }
    if (reports.length === 0) continue;

    const body = json(buildAggregate(day, reports));
    try {
      await client.put(pathname, body, {
        access: "private",
        token,
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: false,
      });
    } catch {
      const raced = await listAll(client, token, pathname);
      if (!raced.some((blob) => blob.pathname === pathname)) {
        throw new Error("Daily aggregate could not be materialized");
      }
    }
    existingAggregates.add(pathname);
    aggregatedDays += 1;
  }
  return aggregatedDays;
}

export function createCspReportStore(options: {
  token: string;
  client?: CspReportBlobClient;
  now?: () => Date;
  eventKey?: () => string;
}) {
  const client = options.client ?? vercelBlobClient;
  const now = options.now ?? (() => new Date());
  const eventKey = options.eventKey ?? (() => crypto.randomUUID());

  return {
    async persist(reports: SanitizedCspReport[]): Promise<void> {
      for (const report of reports) {
        const receivedAt = now();
        const storedReport: SanitizedCspReport = {
          ...report,
          receivedAt: receivedAt.toISOString(),
        };
        const key = eventKey();
        const redacted = redactCspReport(storedReport);
        const common = {
          access: "private" as const,
          token: options.token,
          contentType: "application/json" as const,
          addRandomSuffix: false as const,
          allowOverwrite: false,
        };
        await Promise.all([
          client.put(
            eventPath(CSP_REPORT_NAMESPACES.raw, receivedAt, key),
            json(storedReport),
            common
          ),
          client.put(
            eventPath(CSP_REPORT_NAMESPACES.redacted, receivedAt, key),
            json(redacted),
            common
          ),
        ]);
      }
    },

    async cleanup(): Promise<CspReportCleanupResult> {
      const cleanupNow = now();
      const [raw, redacted, aggregates] = await Promise.all([
        listAll(client, options.token, CSP_REPORT_NAMESPACES.raw),
        listAll(client, options.token, CSP_REPORT_NAMESPACES.redacted),
        listAll(client, options.token, CSP_REPORT_NAMESPACES.aggregate),
      ]);
      const aggregatePaths = new Set(aggregates.map((blob) => blob.pathname));
      const aggregatedDays = await ensureCompletedDayAggregates(
        client,
        options.token,
        redacted,
        aggregatePaths,
        cleanupNow
      );

      const expiredRaw = raw.filter((blob) =>
        olderThan(blob, cleanupNow, CSP_REPORT_RETENTION_DAYS.raw)
      );
      const expiredRedacted = redacted.filter((blob) =>
        olderThan(blob, cleanupNow, CSP_REPORT_RETENTION_DAYS.redacted)
      );
      const expiredAggregates = aggregates.filter((blob) =>
        olderThan(blob, cleanupNow, CSP_REPORT_RETENTION_DAYS.aggregate)
      );

      await deleteInBatches(
        client,
        options.token,
        expiredRaw.map((blob) => blob.pathname)
      );
      await deleteInBatches(
        client,
        options.token,
        expiredRedacted.map((blob) => blob.pathname)
      );
      await deleteInBatches(
        client,
        options.token,
        expiredAggregates.map((blob) => blob.pathname)
      );

      return {
        aggregatedDays,
        deleted: {
          raw: expiredRaw.length,
          redacted: expiredRedacted.length,
          aggregate: expiredAggregates.length,
        },
      };
    },
  };
}
