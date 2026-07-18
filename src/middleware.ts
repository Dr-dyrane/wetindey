import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  buildCspPolicy,
  createCspNonce,
  CSP_DOCUMENT_CACHE_CONTROL,
  CSP_NONCE_HEADER,
  CSP_REPORT_ONLY_HEADER,
  resolveAuthorizedHttpsOrigins,
  resolveCspEnvironment,
} from "@/lib/security/csp-policy";

export function middleware(request: NextRequest): NextResponse {
  const nonce = createCspNonce();
  const policy = buildCspPolicy({
    nonce,
    environment: resolveCspEnvironment(
      process.env.VERCEL_ENV,
      process.env.NODE_ENV,
    ),
    requestOrigin: request.nextUrl.origin,
    authorizedHttpsOrigins: resolveAuthorizedHttpsOrigins({
      configuredAppUrl: process.env.NEXT_PUBLIC_APP_URL,
      vercelUrl: process.env.VERCEL_URL,
      vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
      vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    }),
  });

  const requestHeaders = new Headers(request.headers);
  // Next 15.5 reads Content-Security-Policy before Report-Only when it derives
  // the nonce for its production bootstrap and Flight scripts. This header is
  // internal to the cloned request. The nonce policy reaches the browser only
  // as Report-Only; Vercel's existing static enforcing response stays separate.
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set(CSP_REPORT_ONLY_HEADER, policy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(CSP_REPORT_ONLY_HEADER, policy);
  response.headers.set("Cache-Control", CSP_DOCUMENT_CACHE_CONTROL);

  return response;
}

export const config = {
  matcher: [
    "/((?!api|reports/security/csp|_next|.*[.].*).*)",
  ],
};
