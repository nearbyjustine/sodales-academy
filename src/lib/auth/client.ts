"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * PHASE 2 SEAM.
 *
 * The plan's Task 5 brief guessed `@neondatabase/auth/client`, which does not exist — the
 * installed `@neondatabase/auth@0.5.0-beta`'s `package.json` `exports` map has no `/client`
 * subpath. The real browser-side entry point for a Next.js app is `@neondatabase/auth/next`
 * (the same family as Task 3's server-side `@neondatabase/auth/next/server`), which exports a
 * parameterless `createAuthClient()` returning a `ReactAuthClient` (a better-auth React client
 * pre-wired with `BetterAuthReactAdapter`, per `dist/next/index.mjs`). It needs no `baseUrl` —
 * unlike the package-root `createAuthClient(url, config?)` documented in the README's generic
 * "Basic Usage" section, the `/next` variant is designed to run same-origin against this app's
 * own Neon Auth route handlers, matching `dist/next/index.d.mts`'s zero-arg signature.
 */
export const authClient = createAuthClient();
