import { cookies } from "next/headers";
import { BrandIntro } from "@/components/brand/brand-intro";
import { INTRO_COOKIE } from "@/lib/brand/intro-cookie";

/**
 * Decides server-side whether the intro renders at all, so a returning visitor
 * gets no overlay in their HTML rather than one that disappears after
 * hydration. `cookies()` is async in Next 16.
 *
 * Reading a cookie makes this route dynamic, which it already is — the root
 * layout reads the session.
 */
export async function BrandIntroGate() {
  const store = await cookies();
  if (store.has(INTRO_COOKIE)) return null;
  return <BrandIntro />;
}
