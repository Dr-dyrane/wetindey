"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * The browser's auth client.
 *
 * CALLED WITH NO ARGUMENTS, AND THAT IS LOAD-BEARING — do not "improve" it by
 * passing NEON_AUTH_BASE_URL.
 *
 * better-auth resolves its base URL through `withPath(url, "/api/auth")`, which
 * returns the URL UNCHANGED if it already has a path. NEON_AUTH_BASE_URL is
 * `https://ep-….neonauth.….neon.tech/neondb/auth` — it has a path. So handing it
 * to a browser client points the browser straight at Neon: cross-site requests,
 * third-party cookies, dead on Safari and iOS. The env var the SDK tells you to
 * define is exactly the value that must never reach the client.
 *
 * `createAuthClient()` from @neondatabase/auth/next passes `void 0`, so
 * getBaseURL falls back to `window.location.origin + "/api/auth"` — our own
 * route handler, same-origin, first-party cookies.
 *
 * getBaseURL consults env FIRST, so BETTER_AUTH_URL, NEXT_PUBLIC_BETTER_AUTH_URL,
 * PUBLIC_BETTER_AUTH_URL and BASE_URL would each silently override this. None is
 * set; none may be added.
 */
export const authClient = createAuthClient();
