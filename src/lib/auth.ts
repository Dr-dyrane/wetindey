import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * The server-side auth instance. Singleton, per Neon's own guidance.
 *
 * SERVER ONLY. `@neondatabase/auth/next/server` must never reach a client
 * bundle; the browser talks to `/api/auth/*` through `authClient`
 * (src/lib/auth-client.ts), which is a different module for that reason.
 *
 * `cookies.secret` THROWS at module scope if it is under 32 characters, and this
 * module is imported by a route file — so a missing or short
 * NEON_AUTH_COOKIE_SECRET fails `next build` while it collects that route,
 * rather than at runtime. That is the good failure: loud, and before deploy.
 *
 * sameSite is left at its default of "strict", which is right BECAUSE the flow
 * is same-origin: the sheet POSTs to our own /api/auth, and the proxy rewrites
 * Set-Cookie onto our origin, so the session cookie is first-party. "lax" would
 * buy nothing and would weaken the session cookie everywhere — the setting is
 * uniform, with no per-cookie control. (OAuth would need "lax", because its
 * return is a cross-site top-level navigation and strict withholds the challenge
 * cookie, failing sign-in with no error at all. We do not do OAuth.)
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});
