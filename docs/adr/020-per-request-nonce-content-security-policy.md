# ADR-020: Per-request nonce Content Security Policy

**Date:** 2026-07-18
**Status:** Accepted - implemented at `1384a53` and `cc3b858` (per-request nonce report-only boundary in `src/middleware.ts` and `src/lib/security/csp-policy.ts`; dev-environment resolution at `44f8027`); the static enforcing policy in `vercel.json` remains in place while the nonce boundary reports
**Decision owner:** WetinDey Founder

## Context

`vercel.json` currently emits one static enforcing Content Security Policy with
`script-src 'unsafe-inline'`. Static hosting configuration cannot mint a per-request
nonce. Removing `unsafe-inline` there would block Next's inline React Server Component
bootstrap and the raw scripts in `src/app/layout.tsx`, producing a blank page.

Adding a second nonce policy is not a fix. Multiple enforcing CSP headers intersect; the
static policy would still veto sources allowed only by the request policy. WetinDey
therefore needs one enforcement owner.

The current layout has four explicit script boundaries:

1. the raw inline pre-paint theme script;
2. the raw inline `crypto.randomUUID` compatibility script;
3. the raw inline production service-worker registration script; and
4. the parser-inserted external Mapbox GL script.

Next.js 15.5.20 also emits framework and RSC scripts. Next can propagate a nonce to those
only when it sees the nonce-bearing CSP on the incoming request.

## Decision

WetinDey will use one per-request nonce CSP generated at the request boundary. The later
implementation must remove the static `Content-Security-Policy` entry from `vercel.json`
in the same code change that enables nonce enforcement. Other static security headers
remain. At no point may two enforcing CSP owners ship.

### One policy, two identical header copies

For every matched HTML/document request, the request boundary:

1. creates a cryptographically unpredictable nonce independently for that request;
2. constructs one canonical policy string containing that nonce;
3. clones the incoming request headers and sets both `x-nonce` to the raw nonce and
   `Content-Security-Policy` to that exact canonical policy;
4. passes that clone through
   `NextResponse.next({ request: { headers: clonedRequestHeaders } })` so Next 15.5.20
   receives both request headers and can discover and apply the nonce to its generated
   scripts; and
5. sets the byte-identical canonical policy as `Content-Security-Policy` on that outgoing
   response.

The request and response policy must come from the same value, not two builders or two
templates. A test must compare them byte-for-byte. The nonce is never reused, persisted,
logged, added to analytics, placed in a URL, or exposed as application data.

An `x-nonce` request header alone is insufficient for Next 15.5.20 script nonce
propagation. The boundary MUST provide both `x-nonce` and the exact nonce-bearing
`Content-Security-Policy` on the cloned request headers, MUST pass that clone with the
`NextResponse.next` request-header override above, and MUST emit the identical policy on
the response. Calling `NextResponse.next()` without that request-header override, or
forwarding only `x-nonce`, violates this invariant.

### Script coverage

The nonce must be passed explicitly to all three raw inline `<script>` elements in
`src/app/layout.tsx` and to the parser-inserted external Mapbox `<script src>` element.
The request header lets Next 15.5.20 nonce its own framework/RSC scripts. Production
`script-src` removes `'unsafe-inline'` and does not add a hash or host fallback that
silently makes the raw scripts executable without their nonce.

The parser-inserted Mapbox script remains explicitly nonced even if the policy also names
its origin for compatibility. `worker-src 'self' blob:` remains necessary for the
Mapbox worker. `blob:` is not a general script permission merely because it is required
for a worker.

### Baseline directives

The implementation starts from the current host restrictions and tightens script
execution:

- `default-src 'self'`;
- `script-src 'self' 'nonce-{request}' 'strict-dynamic'` with only evidence-backed
  compatibility hosts;
- `style-src 'self' 'unsafe-inline' https://api.mapbox.com` until style nonces or hashes
  are separately proved;
- narrowly inventoried `img-src`, `font-src`, and `connect-src`;
- `worker-src 'self' blob:` and `child-src 'self' blob:`;
- `manifest-src 'self'`;
- `object-src 'none'`;
- `base-uri 'self'`;
- `form-action 'self'`;
- `frame-src 'none'`;
- `frame-ancestors 'none'`; and
- `upgrade-insecure-requests` outside local development.

This ADR does not bless every origin in the current static policy. Each Mapbox, analytics,
image, and tile origin remains subject to runtime evidence. No broad `https:` source is
allowed as a shortcut.

### Dynamic rendering and caching

Nonce-bearing HTML is request-specific. Every matched page/document response is dynamic
and receives `Cache-Control: private, no-store`. A nonce-bearing document must not be
prerendered, ISR-cached, CDN-shared, service-worker-cached, or replayed to another request.
Static assets keep their normal immutable caching and do not need a document nonce.

The implementation must make Next's dynamic boundary explicit and prove it on Next
15.5.20. A build that happens to render dynamically is not evidence of a stable contract.
Performance and hosting-cost changes from losing static HTML are accepted consequences
and must be measured before production enforcement.

### Environment policy

- **Local development:** may add only the narrowly required development exception such
  as `'unsafe-eval'`; it does not add production `'unsafe-inline'`. Development policy is
  never copied into Preview or Production.
- **Preview:** begins with the production-shaped nonce policy in report-only mode and a
  real violation collector. Preview enforcement follows only after violations are
  explained and required sources are enumerated.
- **Production:** receives the reviewed enforcing policy without development exceptions.
  Promotion is separately authorized after report-only and Preview enforcement evidence.

Policy construction has one shared function with explicit environment inputs. Separate
handwritten policies per environment are prohibited.

### Vercel Blob gap

The current static `img-src` does not name the Vercel Blob delivery origin used by profile
avatars. Before enforcement, implementation must capture the exact authorized Blob host
shape from configured/runtime evidence and add only that image origin. Do not guess a
wildcard and do not add all HTTPS images. If a later browser-direct upload needs a Blob
connection origin, it requires separate `connect-src` evidence. CSP admission does not
settle Blob privacy, authorization, retention, or deletion.

### Report-only rollout

Report-only is a staged evidence mechanism, not permanent protection:

1. deploy the nonce policy as `Content-Security-Policy-Report-Only` with a configured
   collector, redaction, access, and retention policy while the existing static policy
   remains the sole enforcing policy;
2. exercise supported routes, auth, Mapbox, analytics, avatars, offline/service-worker,
   error, light/dark, and supported-device flows;
3. classify every violation and change only evidence-backed directives;
4. enforce in Preview with the static Vercel CSP removed in that same implementation
   change; and
5. separately authorize Production enforcement after clean Preview evidence and rollback
   proof.

The enforcing response must not also emit a stale report-only policy that tests a
different source set and is then cited as enforcement evidence.

## Later implementation boundary

This ADR authorizes architecture, not code. A later exact-path lane owns:

- a single request-boundary file (`middleware.ts` or the Next 15.5.20-supported successor);
- `src/app/layout.tsx` for the three inline script nonces and the Mapbox script nonce;
- `vercel.json` solely to remove its static CSP in the same enforcement change;
- one focused CSP policy module if needed to keep request and response construction
  identical; and
- focused policy, header-equality, nonce-uniqueness, caching, environment, and browser
  verification.

It owns no product behavior, database, authentication semantics, map implementation,
layout redesign, Blob lifecycle policy, or deployment permission. It must not add a route
handler, proxy, platform header, or second middleware that also enforces CSP. One boundary
and one canonical policy builder are the maximum.

## Validation gates

Independent security review must refute:

- reused, predictable, logged, or cached nonces;
- request/response policy mismatch;
- any raw layout or Next-generated script without the request nonce;
- retained production `'unsafe-inline'` or `'unsafe-eval'`;
- simultaneous static and request-boundary enforcing CSP headers;
- nonce-bearing HTML without `private, no-store`;
- missing Mapbox worker/script coverage;
- guessed Blob or third-party wildcards;
- report-only evidence without a real collector and retention rules; and
- environment drift or duplicate policy builders.

## Consequences

- Page HTML becomes dynamic and private rather than cacheable shared output.
- Removing `'unsafe-inline'` materially reduces script-injection exposure.
- Middleware/request-boundary work becomes part of the critical rendering path.
- CSP origin maintenance becomes an explicit security responsibility.
- Avatar delivery remains a known enforcement blocker until the exact Blob origin is
  proved.

## Alternatives rejected

**Keep the static policy with `'unsafe-inline'`.** Rejected; it cannot distinguish
authorized inline scripts from injected ones.

**Emit static and nonce policies together.** Rejected; enforcing policies intersect and
create a blank-page failure or misleading partial rollout.

**Use hashes for everything.** Rejected for Next-generated request-specific bootstrap and
RSC scripts; it also makes raw-script changes fragile without solving request propagation.

**Allow all HTTPS scripts or images.** Rejected; it converts CSP into a protocol check.
