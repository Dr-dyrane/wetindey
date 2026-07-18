const SUPPORTED_MEDIA_TYPES = new Set(["application/csp-report", "application/reports+json"]);
const KNOWN_CSP_DIRECTIVES = new Set([
  "base-uri",
  "block-all-mixed-content",
  "child-src",
  "connect-src",
  "default-src",
  "fenced-frame-src",
  "font-src",
  "form-action",
  "frame-ancestors",
  "frame-src",
  "img-src",
  "manifest-src",
  "media-src",
  "object-src",
  "prefetch-src",
  "report-to",
  "require-trusted-types-for",
  "sandbox",
  "script-src",
  "script-src-attr",
  "script-src-elem",
  "style-src",
  "style-src-attr",
  "style-src-elem",
  "trusted-types",
  "upgrade-insecure-requests",
  "worker-src",
]);

export const CSP_REPORT_LIMITS = {
  maxBytes: 16 * 1024,
  maxBatch: 8,
  maxDepth: 6,
  maxNodes: 128,
  maxObjectKeys: 32,
  maxStringLength: 2_048,
} as const;

export type CspResourceClass =
  | "blob"
  | "data"
  | "eval"
  | "first-party"
  | "inline"
  | "mapbox"
  | "unknown"
  | "unknown-third-party"
  | "vercel-analytics"
  | "vercel-blob"
  | "wasm-eval";

export interface SanitizedCspReport {
  receivedAt: string;
  disposition: "enforce" | "report" | "unknown";
  effectiveDirective: string;
  violatedDirective?: string;
  blockedResource: {
    kind: CspResourceClass;
  };
  documentClass?: CspResourceClass;
  sourceClass?: CspResourceClass;
  statusCode?: number;
  lineNumber?: number;
  columnNumber?: number;
}

export interface RedactedCspReport {
  receivedDay: string;
  disposition: SanitizedCspReport["disposition"];
  effectiveDirective: string;
  violatedDirective?: string;
  blockedKind: CspResourceClass;
  statusClass?: number;
}

export class CspReportInputError extends Error {
  constructor(
    readonly status: 400 | 413 | 415,
    message: string
  ) {
    super(message);
    this.name = "CspReportInputError";
  }
}

interface JsonShapeState {
  nodes: number;
}

function mediaTypeOf(value: string | null): string {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function isSupportedCspReportMediaType(value: string | null): boolean {
  return SUPPORTED_MEDIA_TYPES.has(mediaTypeOf(value));
}

function assertBoundedJsonShape(value: unknown, depth: number, state: JsonShapeState): void {
  state.nodes += 1;
  if (state.nodes > CSP_REPORT_LIMITS.maxNodes) {
    throw new CspReportInputError(400, "Report structure is too large");
  }
  if (depth > CSP_REPORT_LIMITS.maxDepth) {
    throw new CspReportInputError(400, "Report structure is too deep");
  }
  if (typeof value === "string") {
    if (value.length > CSP_REPORT_LIMITS.maxStringLength) {
      throw new CspReportInputError(400, "Report string is too long");
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > CSP_REPORT_LIMITS.maxBatch) {
      throw new CspReportInputError(400, "Report batch is too large");
    }
    for (const entry of value) {
      assertBoundedJsonShape(entry, depth + 1, state);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > CSP_REPORT_LIMITS.maxObjectKeys) {
      throw new CspReportInputError(400, "Report object has too many fields");
    }
    for (const [, entry] of entries) {
      assertBoundedJsonShape(entry, depth + 1, state);
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : undefined;
}

function directive(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().split(/\s+/, 1)[0];
  if (!normalized) return undefined;
  return KNOWN_CSP_DIRECTIVES.has(normalized) ? normalized : "unknown";
}

function disposition(value: unknown): SanitizedCspReport["disposition"] {
  return value === "enforce" || value === "report" ? value : "unknown";
}

function resourceClass(value: unknown): CspResourceClass | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "wetindey.live" || hostname.endsWith(".wetindey.live")) {
      return "first-party";
    }
    if (
      hostname === "api.mapbox.com" ||
      hostname === "events.mapbox.com" ||
      hostname.endsWith(".tiles.mapbox.com")
    ) {
      return "mapbox";
    }
    if (hostname === "vitals.vercel-insights.com" || hostname === "va.vercel-scripts.com") {
      return "vercel-analytics";
    }
    if (hostname.endsWith(".blob.vercel-storage.com")) {
      return "vercel-blob";
    }
    return "unknown-third-party";
  } catch {
    return undefined;
  }
}

function blockedResource(value: unknown): SanitizedCspReport["blockedResource"] {
  if (typeof value !== "string") return { kind: "unknown" };
  const normalized = value.trim().toLowerCase();
  if (normalized === "inline") return { kind: "inline" };
  if (normalized === "eval") return { kind: "eval" };
  if (normalized === "wasm-eval") return { kind: "wasm-eval" };
  if (normalized.startsWith("data:")) return { kind: "data" };
  if (normalized.startsWith("blob:")) return { kind: "blob" };

  return { kind: resourceClass(value) ?? "unknown" };
}

function sanitizeReportRecord(
  body: Record<string, unknown>,
  fallbackDocumentUrl: unknown,
  receivedAt: Date
): SanitizedCspReport | null {
  const effectiveDirective =
    directive(body.effectiveDirective) ??
    directive(body["effective-directive"]) ??
    directive(body.violatedDirective) ??
    directive(body["violated-directive"]);
  if (!effectiveDirective) return null;

  const violatedDirective =
    directive(body.violatedDirective) ?? directive(body["violated-directive"]);
  const documentClass =
    resourceClass(body.documentURL) ??
    resourceClass(body["document-uri"]) ??
    resourceClass(fallbackDocumentUrl);
  const sourceClass = resourceClass(body.sourceFile) ?? resourceClass(body["source-file"]);
  const blocked = blockedResource(body.blockedURL ?? body["blocked-uri"]);

  return {
    receivedAt: receivedAt.toISOString(),
    disposition: disposition(body.disposition),
    effectiveDirective,
    ...(violatedDirective ? { violatedDirective } : {}),
    blockedResource: blocked,
    ...(documentClass ? { documentClass } : {}),
    ...(sourceClass ? { sourceClass } : {}),
    ...((boundedInteger(body.statusCode ?? body["status-code"], 0, 599) ?? undefined)
      ? {
          statusCode: boundedInteger(body.statusCode ?? body["status-code"], 0, 599),
        }
      : {}),
    ...((boundedInteger(body.lineNumber ?? body["line-number"], 0, 1_000_000) ?? undefined)
      ? {
          lineNumber: boundedInteger(body.lineNumber ?? body["line-number"], 0, 1_000_000),
        }
      : {}),
    ...((boundedInteger(body.columnNumber ?? body["column-number"], 0, 1_000_000) ?? undefined)
      ? {
          columnNumber: boundedInteger(body.columnNumber ?? body["column-number"], 0, 1_000_000),
        }
      : {}),
  };
}

function sanitizeLegacyPayload(value: unknown, receivedAt: Date): SanitizedCspReport[] {
  const envelope = asRecord(value);
  const body = asRecord(envelope?.["csp-report"]);
  const report = body ? sanitizeReportRecord(body, body["document-uri"], receivedAt) : null;
  if (!report) {
    throw new CspReportInputError(400, "Invalid CSP report");
  }
  return [report];
}

function sanitizeReportingApiPayload(value: unknown, receivedAt: Date): SanitizedCspReport[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > CSP_REPORT_LIMITS.maxBatch) {
    throw new CspReportInputError(400, "Invalid CSP report batch");
  }

  const reports: SanitizedCspReport[] = [];
  for (const entry of value) {
    const envelope = asRecord(entry);
    if (!envelope || envelope.type !== "csp-violation") continue;
    const body = asRecord(envelope.body);
    if (!body) continue;
    const report = sanitizeReportRecord(body, envelope.url, receivedAt);
    if (report) reports.push(report);
  }
  if (reports.length === 0) {
    throw new CspReportInputError(400, "No valid CSP reports");
  }
  return reports;
}

export function parseAndSanitizeCspReportText(
  text: string,
  contentType: string | null,
  receivedAt = new Date()
): SanitizedCspReport[] {
  const mediaType = mediaTypeOf(contentType);
  if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
    throw new CspReportInputError(415, "Unsupported CSP report media type");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new CspReportInputError(400, "Invalid JSON");
  }
  assertBoundedJsonShape(parsed, 0, { nodes: 0 });

  return mediaType === "application/csp-report"
    ? sanitizeLegacyPayload(parsed, receivedAt)
    : sanitizeReportingApiPayload(parsed, receivedAt);
}

export function redactCspReport(report: SanitizedCspReport): RedactedCspReport {
  return {
    receivedDay: report.receivedAt.slice(0, 10),
    disposition: report.disposition,
    effectiveDirective: report.effectiveDirective,
    ...(report.violatedDirective ? { violatedDirective: report.violatedDirective } : {}),
    blockedKind: report.blockedResource.kind,
    ...(report.statusCode !== undefined
      ? { statusClass: Math.floor(report.statusCode / 100) }
      : {}),
  };
}

async function readBoundedBody(request: Request): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = Number(contentLength);
    if (!Number.isFinite(length) || length < 0 || length > CSP_REPORT_LIMITS.maxBytes) {
      throw new CspReportInputError(413, "CSP report body is too large");
    }
  }
  if (!request.body) {
    throw new CspReportInputError(400, "Missing CSP report body");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > CSP_REPORT_LIMITS.maxBytes) {
        await reader.cancel();
        throw new CspReportInputError(413, "CSP report body is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function emptyResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": "0",
    },
  });
}

export async function handleCspReportPost(
  request: Request,
  persist: (reports: SanitizedCspReport[]) => Promise<void>,
  receivedAt = new Date()
): Promise<Response> {
  if (!isSupportedCspReportMediaType(request.headers.get("content-type"))) {
    return emptyResponse(415);
  }

  try {
    const text = await readBoundedBody(request);
    const reports = parseAndSanitizeCspReportText(
      text,
      request.headers.get("content-type"),
      receivedAt
    );
    try {
      await persist(reports);
    } catch {
      // Collection is intentionally fail-open. Never log the untrusted payload
      // or let report storage affect the application that emitted it.
    }
    return emptyResponse(204);
  } catch (error) {
    if (error instanceof CspReportInputError) {
      return emptyResponse(error.status);
    }
    return emptyResponse(400);
  }
}
