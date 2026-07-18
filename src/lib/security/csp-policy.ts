export const CSP_NONCE_HEADER = "x-nonce";
export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";
export const CSP_DOCUMENT_CACHE_CONTROL = "private, no-store";
export const CSP_REPORT_ENDPOINT = "/reports/security/csp";

const NONCE_BYTE_LENGTH = 16;
const CSP_NONCE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export type CspEnvironment = "development" | "preview" | "production";

export type CspPolicyInput = {
  readonly nonce: string;
  readonly environment: CspEnvironment;
  readonly requestOrigin: string;
  readonly authorizedHttpsOrigins: readonly string[];
};

export type CspHostConfiguration = {
  readonly configuredAppUrl?: string;
  readonly vercelUrl?: string;
  readonly vercelBranchUrl?: string;
  readonly vercelProductionUrl?: string;
};

export function createCspNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return globalThis
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function isCspNonce(value: string): boolean {
  return CSP_NONCE_PATTERN.test(value);
}

export function resolveCspEnvironment(
  vercelEnvironment: string | undefined,
  nodeEnvironment: string | undefined,
): CspEnvironment {
  if (vercelEnvironment === "preview") return "preview";
  if (vercelEnvironment === "production") return "production";
  if (vercelEnvironment === "development" || nodeEnvironment === "development") {
    return "development";
  }
  return "production";
}

function asHttpsOrigin(value: string | undefined, hostOnly: boolean): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;

  try {
    const url = new URL(hostOnly && !candidate.includes("://") ? `https://${candidate}` : candidate);
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function resolveAuthorizedHttpsOrigins({
  configuredAppUrl,
  vercelUrl,
  vercelBranchUrl,
  vercelProductionUrl,
}: CspHostConfiguration): readonly string[] {
  const candidates = [
    asHttpsOrigin(configuredAppUrl, false),
    asHttpsOrigin(vercelUrl, true),
    asHttpsOrigin(vercelBranchUrl, true),
    asHttpsOrigin(vercelProductionUrl, true),
  ];

  return Array.from(
    new Set(candidates.filter((origin): origin is string => origin !== undefined)),
  );
}

function isAuthorizedHttpsRequest(
  requestOrigin: string,
  authorizedHttpsOrigins: readonly string[],
): boolean {
  try {
    const requestUrl = new URL(requestOrigin);
    return (
      requestUrl.protocol === "https:" &&
      authorizedHttpsOrigins.includes(requestUrl.origin)
    );
  } catch {
    return false;
  }
}

export function buildCspPolicy({
  nonce,
  environment,
  requestOrigin,
  authorizedHttpsOrigins,
}: CspPolicyInput): string {
  if (!isCspNonce(nonce)) {
    throw new Error("CSP policy requires a 128-bit base64url nonce.");
  }

  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://api.mapbox.com",
    "https://va.vercel-scripts.com",
  ];
  if (environment === "development") scriptSources.push("'unsafe-eval'");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
    "img-src 'self' data: blob: https://api.mapbox.com https://upload.wikimedia.org",
    "font-src 'self'",
    "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://upload.wikimedia.org https://vitals.vercel-insights.com",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (
    environment !== "development" &&
    isAuthorizedHttpsRequest(requestOrigin, authorizedHttpsOrigins)
  ) {
    directives.push("upgrade-insecure-requests");
  }

  directives.push(`report-uri ${CSP_REPORT_ENDPOINT}`);
  return directives.join("; ");
}
