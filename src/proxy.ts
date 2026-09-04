import { auth } from "@/lib/auth/server";

/**
 * Neon Auth's OAuth flow redirects back to this app with a `neon_auth_session_verifier` query
 * param that must be exchanged for a real session cookie server-side before any Server Component
 * reads `auth.getSession()` — without this proxy, that exchange never runs and every post-OAuth
 * request looks unauthenticated, redirect-looping the user back to `/login` forever. This is the
 * package's own documented integration point (`node_modules/@neondatabase/auth/dist/next/server
 * /index.d.mts`'s `middleware()` example), renamed from Next 15's `middleware.ts` to Next 16's
 * `proxy.ts` (`node_modules/next/dist/docs/.../proxy.md`) — same exported function shape, new
 * file/export name.
 *
 * `auth.middleware()` also enforces its own route protection (redirecting an unauthenticated
 * visitor on any matched path to `loginUrl`), which is NOT what the rest of the app wants: the
 * course catalog and home page are deliberately world-readable (this repo's CLAUDE.md), and every
 * authenticated route already re-derives its own session server-side via `requireUser`/
 * `requireRole` (spec §8) rather than trusting this proxy. The `matcher` below is scoped to only
 * the route trees that are already authenticated-only, so the OAuth verifier exchange runs where
 * it's needed without adding a second, redundant gate in front of public pages.
 */
export default auth.middleware({ loginUrl: "/login" });

export const config = {
  matcher: ["/dashboard/:path*", "/learn/:path*", "/admin/:path*"],
};
