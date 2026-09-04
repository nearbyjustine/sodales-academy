/**
 * Session cookie that records the brand intro has already played.
 *
 * It lives in its own plain module on purpose. `brand-intro.tsx` is
 * `"use client"`, and importing a constant from a client module into a Server
 * Component hands back a client *reference*, not the string — which silently
 * made `cookies().has(...)` always false and replayed the intro on every load.
 */
export const INTRO_COOKIE = "sodales_intro";
