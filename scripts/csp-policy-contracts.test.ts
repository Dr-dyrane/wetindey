import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { config, middleware } from "../src/middleware";
import {
  buildCspPolicy,
  createCspNonce,
  CSP_DOCUMENT_CACHE_CONTROL,
  CSP_NONCE_HEADER,
  CSP_REPORT_ENDPOINT,
  CSP_REPORT_ONLY_HEADER,
  isCspNonce,
  resolveAuthorizedHttpsOrigins,
} from "../src/lib/security/csp-policy";

const ROOT = process.cwd();
const ENV_KEYS = [
  "NODE_ENV",
  "VERCEL_ENV",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;

type EnvironmentOverrides = Partial<Record<(typeof ENV_KEYS)[number], string>>;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function requiredHeader(headers: Headers, name: string): string {
  const value = headers.get(name);
  assert.ok(value, `missing ${name}`);
  return value;
}

function directive(policy: string, name: string): string {
  const value = policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name);
  assert.ok(value, `missing ${name}`);
  return value;
}

function withEnvironment<T>(overrides: EnvironmentOverrides, run: () => T): T {
  const original = new Map(
    ENV_KEYS.map((key) => [key, process.env[key]] as const),
  );

  for (const key of ENV_KEYS) {
    const value = overrides[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return run();
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function middlewareMatches(path: string): boolean {
  return unstable_doesMiddlewareMatch({
    config,
    nextConfig: {},
    url: path,
  });
}

const policySource = read("src/lib/security/csp-policy.ts");
const middlewareSource = read("src/middleware.ts");
const layoutSource = read("src/app/layout.tsx");
const vercelConfig = JSON.parse(read("vercel.json")) as {
  headers: Array<{
    headers: Array<{ key: string; value: string }>;
  }>;
};

// A fresh document request gets a Web Crypto nonce with 128 bits of input.
const nonces = new Set<string>();
for (let index = 0; index < 64; index += 1) {
  const nonce = createCspNonce();
  assert.ok(isCspNonce(nonce), nonce);
  nonces.add(nonce);
}
assert.equal(nonces.size, 64);
assert.match(policySource, /crypto\.getRandomValues\(bytes\)/);
assert.doesNotMatch(policySource, /Math\.random/);
assert.throws(
  () =>
    buildCspPolicy({
      nonce: "not-a-valid-nonce",
      environment: "production",
      requestOrigin: "https://wetindey.app",
      authorizedHttpsOrigins: ["https://wetindey.app"],
    }),
  /128-bit base64url nonce/,
);

const fixedNonce = createCspNonce();
const authorizedOrigins = resolveAuthorizedHttpsOrigins({
  configuredAppUrl: "https://wetindey.app/path-is-ignored",
  vercelUrl: "wetindey-git-h6.vercel.app",
  vercelBranchUrl: "https://h6.wetindey.vercel.app/",
  vercelProductionUrl: "wetindey.app",
});
assert.deepEqual(authorizedOrigins, [
  "https://wetindey.app",
  "https://wetindey-git-h6.vercel.app",
  "https://h6.wetindey.vercel.app",
]);

const previewPolicy = buildCspPolicy({
  nonce: fixedNonce,
  environment: "preview",
  requestOrigin: "https://wetindey-git-h6.vercel.app",
  authorizedHttpsOrigins: authorizedOrigins,
});
assert.equal(
  previewPolicy,
  buildCspPolicy({
    nonce: fixedNonce,
    environment: "preview",
    requestOrigin: "https://wetindey-git-h6.vercel.app",
    authorizedHttpsOrigins: authorizedOrigins,
  }),
);
assert.doesNotMatch(previewPolicy, /[\r\n]/);
assert.match(previewPolicy, /upgrade-insecure-requests/);
assert.equal(directive(previewPolicy, "report-uri"), `report-uri ${CSP_REPORT_ENDPOINT}`);

const previewScript = directive(previewPolicy, "script-src");
assert.match(previewScript, new RegExp(`'nonce-${fixedNonce}'`));
assert.match(previewScript, /'strict-dynamic'/);
assert.match(previewScript, /https:\/\/api\.mapbox\.com/);
assert.doesNotMatch(previewScript, /'unsafe-inline'/);
assert.doesNotMatch(previewScript, /'unsafe-eval'/);
assert.doesNotMatch(previewScript, /\bblob:/);
assert.match(directive(previewPolicy, "style-src"), /'unsafe-inline'/);
assert.match(directive(previewPolicy, "worker-src"), /\bblob:/);

for (const [environment, requestOrigin] of [
  ["development", "http://localhost:3000"],
  ["development", "https://wetindey.app"],
  ["preview", "http://wetindey-git-h6.vercel.app"],
  ["preview", "https://not-authorized.example"],
] as const) {
  const policy = buildCspPolicy({
    nonce: fixedNonce,
    environment,
    requestOrigin,
    authorizedHttpsOrigins: authorizedOrigins,
  });
  assert.doesNotMatch(
    policy,
    /(?:^|; )upgrade-insecure-requests(?:;|$)/,
    `${environment} ${requestOrigin}`,
  );
}

const developmentPolicy = buildCspPolicy({
  nonce: fixedNonce,
  environment: "development",
  requestOrigin: "http://localhost:3000",
  authorizedHttpsOrigins: [],
});
assert.match(directive(developmentPolicy, "script-src"), /'unsafe-eval'/);
assert.doesNotMatch(directive(developmentPolicy, "script-src"), /'unsafe-inline'/);

// The exact same policy instance reaches Next's overridden request and the browser.
const response = withEnvironment(
  {
    NODE_ENV: "production",
    VERCEL_ENV: "preview",
    NEXT_PUBLIC_APP_URL: "https://wetindey.app",
    VERCEL_URL: "wetindey-git-h6.vercel.app",
  },
  () =>
    middleware(
      new NextRequest("https://wetindey-git-h6.vercel.app/", {
        headers: {
          accept: "text/html",
          "content-security-policy": "script-src 'nonce-attacker'",
        },
      }),
    ),
);
const responsePolicy = requiredHeader(response.headers, CSP_REPORT_ONLY_HEADER);
const requestPolicy = requiredHeader(
  response.headers,
  `x-middleware-request-${CSP_REPORT_ONLY_HEADER.toLowerCase()}`,
);
const requestNonce = requiredHeader(
  response.headers,
  `x-middleware-request-${CSP_NONCE_HEADER}`,
);
assert.equal(requestPolicy, responsePolicy);
assert.match(responsePolicy, new RegExp(`'nonce-${requestNonce}'`));
assert.ok(isCspNonce(requestNonce));
assert.equal(response.headers.get("Content-Security-Policy"), null);
assert.equal(
  response.headers.get("x-middleware-request-content-security-policy"),
  null,
);
assert.equal(response.headers.get(CSP_NONCE_HEADER), null);
assert.equal(
  response.headers.get("Cache-Control"),
  CSP_DOCUMENT_CACHE_CONTROL,
);
assert.match(
  requiredHeader(response.headers, "x-middleware-override-headers"),
  /(?:^|,)x-nonce(?:,|$)/,
);

const middlewareNonces = withEnvironment(
  {
    NODE_ENV: "production",
    VERCEL_ENV: "preview",
    VERCEL_URL: "wetindey-git-h6.vercel.app",
  },
  () => {
    const values = new Set<string>();
    for (let index = 0; index < 32; index += 1) {
      const documentResponse = middleware(
        new NextRequest(`https://wetindey-git-h6.vercel.app/?request=${index}`),
      );
      const nonce = requiredHeader(
        documentResponse.headers,
        `x-middleware-request-${CSP_NONCE_HEADER}`,
      );
      const policy = requiredHeader(
        documentResponse.headers,
        CSP_REPORT_ONLY_HEADER,
      );
      assert.match(policy, new RegExp(`'nonce-${nonce}'`));
      values.add(nonce);
    }
    return values;
  },
);
assert.equal(middlewareNonces.size, 32);

const localResponse = withEnvironment(
  {
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
  () => middleware(new NextRequest("http://localhost:3000/")),
);
const localPolicy = requiredHeader(localResponse.headers, CSP_REPORT_ONLY_HEADER);
assert.doesNotMatch(localPolicy, /upgrade-insecure-requests/);
assert.match(directive(localPolicy, "script-src"), /'unsafe-eval'/);

// The layout consumes only the overridden request nonce and wires every live script.
assert.match(layoutSource, /export const dynamic = "force-dynamic";/);
assert.match(layoutSource, /export const revalidate = 0;/);
assert.match(layoutSource, /export default async function RootLayout/);
assert.match(
  layoutSource,
  /const nonce = \(await headers\(\)\)\.get\(CSP_NONCE_HEADER\);/,
);
assert.match(layoutSource, /if \(!nonce \|\| !isCspNonce\(nonce\)\)/);
assert.equal(layoutSource.match(/nonce=\{nonce\}/g)?.length, 4);
assert.equal(layoutSource.match(/dangerouslySetInnerHTML=/g)?.length, 3);
assert.match(
  layoutSource,
  /<script\s+nonce=\{nonce\}\s+src="https:\/\/api\.mapbox\.com\/mapbox-gl-js\/v3\.1\.2\/mapbox-gl\.js"\s+defer\s+\/>/,
);

// The matcher keeps nonce-bearing policy off non-document and collector routes.
for (const path of ["/", "/item/rice", "/place/mile-12"]) {
  assert.equal(middlewareMatches(path), true, path);
}
for (const path of [
  "/api/auth/session",
  "/reports/security/csp",
  "/reports/security/csp/cleanup",
  "/_next/static/chunks/main.js",
  "/_next/image?url=%2Ficon.png&w=64&q=75",
  "/_next/webpack-hmr",
  "/_next/data/build/index.json",
  "/icon-192.png",
  "/apple-icon.png",
  "/asset.js",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/sw.js",
  "/robots.txt",
  "/sitemap.xml",
]) {
  assert.equal(middlewareMatches(path), false, path);
}

assert.match(
  middlewareSource,
  /NextResponse\.next\(\{\s*request: \{ headers: requestHeaders \},\s*\}\)/,
);
assert.match(
  middlewareSource,
  /requestHeaders\.delete\("Content-Security-Policy"\)/,
);
assert.equal(middlewareSource.match(/buildCspPolicy\(/g)?.length, 1);

// Report-only does not replace or duplicate the current sole enforcing owner.
const enforcingCspHeaders = vercelConfig.headers
  .flatMap((entry) => entry.headers)
  .filter(({ key }) => key.toLowerCase() === "content-security-policy");
const reportOnlyVercelHeaders = vercelConfig.headers
  .flatMap((entry) => entry.headers)
  .filter(
    ({ key }) =>
      key.toLowerCase() === "content-security-policy-report-only",
  );
assert.equal(enforcingCspHeaders.length, 1);
assert.match(enforcingCspHeaders[0].value, /script-src 'self' 'unsafe-inline'/);
assert.equal(reportOnlyVercelHeaders.length, 0);

console.log("Nonce CSP report-only contracts satisfied.");
