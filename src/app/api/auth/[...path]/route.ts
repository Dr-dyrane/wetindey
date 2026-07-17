import { auth } from "@/lib/auth";

/**
 * The Neon Auth proxy. Everything under /api/auth/* is forwarded to the managed
 * Better Auth server, and — this is the whole point of proxying rather than
 * letting the browser talk to Neon — the Set-Cookie headers come back rewritten
 * onto OUR origin. The session cookie is therefore first-party, which is what
 * makes the default SameSite=strict correct and Safari's third-party cookie
 * policy irrelevant to us.
 *
 * THE DIRECTORY NAME IS [...path] AND IT CANNOT BE [...all].
 * The SDK's own JSDoc says `[...all]` twice (dist/next/server/index.d.mts:143,
 * :147) while its types say `Params = { path: string[] }` (:129), which the
 * handler reads as `(await params).path.join("/")`. Follow the JSDoc and
 * `params.path` is undefined, so EVERY auth request dies on "Cannot read
 * properties of undefined (reading 'join')". Two Neon-authored sources disagree;
 * the type is the one that runs, and their newer createNeonAuth docblock
 * (:593) agrees with it.
 *
 * NO middleware.ts ACCOMPANIES THIS, deliberately — and note Neon's own example
 * at :607 ships the matcher `['/((?!_next/static|_next/image|favicon.ico).*)']`,
 * which would gate "/" itself.
 *
 * Their middleware exists to run the OAuth verifier exchange, and it protects
 * routes against a HARDCODED skipRoutes constant with no config surface:
 * shouldProtectRoute("/") returns true, so that matcher would redirect every
 * anonymous shopper to /auth/sign-in — a route this app does not have — and wall
 * the public price map behind a 404. Email OTP never navigates (there is not one
 * `ctx.redirect` in better-auth's email-otp plugin), so it needs no exchange and
 * no middleware. The login-wall problem therefore does not need mitigating; it
 * cannot occur. Auth here is recognition, never a gate.
 *
 * Session refresh does not need the middleware either — trySessionCache re-mints
 * expired session data on the get-session path, through this handler.
 */
export const { GET, POST } = auth.handler();
