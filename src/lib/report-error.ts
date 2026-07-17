/**
 * One place errors go.
 *
 * Every catch block, every error boundary and every failed action should end up
 * here rather than at a bare `console.error`, so that there is exactly one
 * decision about where errors are sent and exactly one place to change it.
 *
 * WHY THIS TALKS TO SENTRY OVER HTTP INSTEAD OF USING THE SDK
 * ----------------------------------------------------------
 * `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` have been declared in `.env.example`
 * for the life of the project and read by nothing. `@sentry/nextjs` is NOT a
 * dependency (see package.json), and adding it is a decision, not a fix: it
 * pulls in an instrumentation hook, a webpack plugin, source-map upload
 * credentials in CI, and a client bundle measured in tens of kilobytes on a
 * product whose users are on Nigerian mobile data. That is a call for whoever
 * owns the budget, not for an error-boundary patch.
 *
 * So this speaks Sentry's ingest protocol directly: one `fetch` of one envelope
 * to the endpoint encoded in the DSN. It is ~40 lines, has no bundle cost worth
 * measuring, and is enough to turn "the app went white for someone in Festac"
 * into a report with a message, a stack and a digest.
 *
 * What it deliberately does NOT do, and what the SDK would give you:
 *   · breadcrumbs, sessions, release health, performance traces
 *   · automatic capture of unhandled rejections and window.onerror
 *   · stack-frame parsing + source-map symbolication, so grouping is by
 *     message rather than by frame, and stacks arrive as raw text (below)
 * When those are wanted, install the SDK and reduce this file to a re-export.
 * The call sites should not have to change.
 *
 * WITHOUT A DSN it logs to the console. Not a no-op: an error that vanishes
 * because an env var is unset is the same white screen with extra steps.
 */

/* Not exported: ReportErrorOptions.scope is the public surface; callers pass a
   string literal and never need the union by name. */
type ErrorScope =
  /** Route-level React error boundary — src/app/error.tsx */
  | "app/error-boundary"
  /** Root error boundary; the layout itself failed — src/app/global-error.tsx */
  | "app/global-error-boundary"
  /** Server action threw before it could return a result shape */
  | "server-action"
  /** Map adapter, tiles, geolocation */
  | "map"
  /** Price submission / offline queue */
  | "reporting"
  /** Anything not yet classified. Prefer adding a scope over using this. */
  | "unknown";

export interface ReportErrorOptions {
  /** Where this came from. Becomes a Sentry tag, so keep the set small. */
  scope: ErrorScope;
  /**
   * Next's error digest. On the server the real message is stripped from the
   * client for security and only this hash crosses the wire, so it is the ONLY
   * join between what the user saw and what the server logged. Always pass it
   * when you have it.
   */
  digest?: string;
  /** Anything else worth having when reading the report. Keep it non-personal. */
  extra?: Record<string, unknown>;
}

/** Sentry event id: 32 lowercase hex chars, no dashes. */
function eventId(): string {
  // crypto.randomUUID is unavailable in non-secure contexts — which includes
  // hitting the dev server from a phone over http://192.168.x.x, exactly how
  // this app gets tested. Falling back is fine here: an id only has to be
  // unique, and a wrong id cannot be mistaken for a right answer.
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID().replace(/-/g, "");
  let out = "";
  for (let i = 0; i < 32; i += 1) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

interface ParsedDsn {
  endpoint: string;
  publicKey: string;
}

/**
 * Split a DSN into its ingest endpoint and public key.
 *
 * DSN shape: https://<publicKey>@<host><path>/<projectId>
 * Envelope:  https://<host><path>/api/<projectId>/envelope/
 *
 * Returns null on anything unparseable rather than throwing — this is the
 * reporting path, and a malformed env var must not become a second error on top
 * of the one being reported. The console fallback still fires, so nothing is
 * lost silently; the miss is visible in the log the caller was going to write
 * anyway.
 */
function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split("/").filter(Boolean).pop();
    if (!url.username || !projectId) return null;
    const prefix = url.pathname.slice(0, url.pathname.lastIndexOf("/"));
    return {
      endpoint: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

/**
 * Read the DSN for the current runtime.
 *
 * Both halves are named statically because Next inlines `process.env.X` at
 * build time only for literal member access — a computed lookup would resolve
 * to undefined in the browser bundle and this would look like "Sentry is off"
 * forever. Server prefers the private var; the browser can only ever see the
 * NEXT_PUBLIC one, and a DSN is a write-only public key by design.
 */
function resolveDsn(): string | undefined {
  const dsn =
    typeof window === "undefined"
      ? process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
      : process.env.NEXT_PUBLIC_SENTRY_DSN;
  return dsn && dsn.length > 0 ? dsn : undefined;
}

function normalise(error: unknown): { type: string; value: string; stack?: string } {
  if (error instanceof Error) {
    return { type: error.name || "Error", value: error.message || String(error), stack: error.stack };
  }
  // A thrown string/object/null. Say so plainly rather than rendering
  // "[object Object]" and pretending it was an Error.
  return { type: "ThrownValue", value: typeof error === "string" ? error : safeStringify(error) };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Report an error. Returns the event id so the UI can show it to the user and a
 * support conversation can start with "give me the code on the screen".
 *
 * Never throws and never awaits: reporting is best-effort by definition, and
 * whatever called this has a user waiting on a real problem.
 */
export function reportError(error: unknown, options: ReportErrorOptions): string {
  const id = eventId();
  const { type, value, stack } = normalise(error);
  const dsn = resolveDsn();
  const parsed = dsn ? parseDsn(dsn) : null;

  // Console always. When Sentry is configured this duplicates — deliberately:
  // the browser console and `vercel logs` are where anyone actually debugging
  // is looking, and the id printed here is the one to paste into Sentry.
  console.error(`[wetindey:${options.scope}] ${type}: ${value}`, {
    eventId: id,
    digest: options.digest,
    ...options.extra,
    error,
  });

  if (!parsed) {
    if (dsn) {
      // The var is set but unusable. Say which var, never the value.
      console.warn(
        "[wetindey:report-error] SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN is set but is not a parseable DSN. Reporting to console only.",
      );
    }
    return id;
  }

  const runtime = typeof window === "undefined" ? "server" : "browser";
  const payload = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    logger: options.scope,
    // APP_ENV is server-only (.env.example declares no NEXT_PUBLIC twin), so the
    // browser falls back to NODE_ENV, which Next inlines on both sides. Do not
    // "fix" this by reading process.env.APP_ENV in the browser — it resolves to
    // undefined there and every client event would be tagged "unknown".
    environment:
      (typeof window === "undefined" ? process.env.APP_ENV : undefined) || process.env.NODE_ENV || "unknown",
    tags: { scope: options.scope, runtime, ...(options.digest ? { digest: options.digest } : {}) },
    exception: { values: [{ type, value }] },
    // The stack rides as text, not as parsed frames. Without the SDK there is
    // no source-map upload, so parsed frames would point at minified bundle
    // offsets and read as precise while being useless. Raw text is honest.
    extra: { ...options.extra, ...(stack ? { stack } : {}), ...(options.digest ? { digest: options.digest } : {}) },
    ...(runtime === "browser" ? { request: { url: window.location.href } } : {}),
  };

  const envelope =
    `${JSON.stringify({ event_id: id, sent_at: new Date().toISOString() })}\n` +
    `${JSON.stringify({ type: "event" })}\n` +
    `${JSON.stringify(payload)}\n`;

  void fetch(`${parsed.endpoint}?sentry_key=${parsed.publicKey}&sentry_version=7`, {
    method: "POST",
    body: envelope,
    headers: { "Content-Type": "application/x-sentry-envelope" },
    // The page is often being torn down or reloaded right after this fires.
    // keepalive lets the request outlive it; it is browser-only.
    ...(runtime === "browser" ? { keepalive: true } : {}),
  }).catch((cause: unknown) => {
    // Reporting the reporter would loop. One line, and stop.
    console.warn("[wetindey:report-error] could not deliver event", id, cause);
  });

  return id;
}
