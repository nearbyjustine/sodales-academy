import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * PHASE 2 SEAM.
 *
 * `createNeonAuth` lives at `@neondatabase/auth/next/server` (not the package root — verified
 * against the installed `@neondatabase/auth@0.5.0-beta`'s own README/llms.txt/dist/*.d.mts, since
 * the plan's Task 3 snippet was an unverified sketch).
 *
 * `cookies.secret` is a REQUIRED field of `NeonAuthConfig` (`SessionCookieConfig.secret: string`,
 * no `?`) and is validated at construction time (`validateCookieConfig` throws if missing or under
 * 32 characters). This is NOT the same secret the plan's Prerequisites section ruled out — that
 * section correctly found that Neon Auth's *hosted* JWKS/signing keys need no config from us, but
 * `cookies.secret` is a separate, local secret the npm SDK uses to sign its own session-data cache
 * cookie (the 60s in-memory/cookie cache documented in the package README's "Performance
 * Features"). The two are unrelated: one lives on Neon's auth server, this one lives in our
 * environment. `NEON_AUTH_COOKIE_SECRET` must be generated (`openssl rand -base64 32`) and added to
 * `.env.local` — see the Task 3 report for details.
 */

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

if (!baseUrl) {
  throw new Error("NEON_AUTH_BASE_URL is not set.");
}

if (!cookieSecret) {
  throw new Error(
    "NEON_AUTH_COOKIE_SECRET is not set. The installed @neondatabase/auth package requires " +
      "cookies.secret (a locally-generated string, at least 32 characters) to sign its own " +
      "session-data cache cookie — this is separate from Neon Auth's hosted JWKS signing keys. " +
      "Generate one with `openssl rand -base64 32` and add NEON_AUTH_COOKIE_SECRET to .env.local.",
  );
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
  },
});
