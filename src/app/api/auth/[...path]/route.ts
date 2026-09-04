import { auth } from "@/lib/auth/server";

// `auth.handler` is a method (`.handler()`), not a plain property — verified against the
// installed @neondatabase/auth@0.5.0-beta's dist/next/server/index.d.mts. Calling it returns the
// { GET, POST, PUT, DELETE, PATCH } route-handler map.
export const { GET, POST } = auth.handler();
