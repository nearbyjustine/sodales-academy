import { cookies, headers } from "next/headers";
import { BrandIntro } from "@/components/brand/brand-intro";
import { INTRO_COOKIE } from "@/lib/brand/intro-cookie";

/**
 * Decides server-side whether the intro renders at all, so a returning visitor
 * gets no overlay in their HTML rather than one that disappears after
 * hydration. `cookies()`/`headers()` are async in Next 16.
 *
 * Reading a cookie makes this route dynamic, which it already is — the root
 * layout reads the session.
 */
export async function BrandIntroGate() {
  const [store, headerList] = await Promise.all([cookies(), headers()]);

  // Home page only. The proxy sets x-pathname because Server Components have no
  // access to the pathname, and mounting this inside (site)/page.tsx instead
  // would put it back behind app/loading.tsx's Suspense boundary — the ivory
  // skeleton flash this component's root-layout placement exists to avoid.
  if (headerList.get("x-pathname") !== "/") return null;
  if (store.has(INTRO_COOKIE)) return null;

  return <BrandIntro />;
}
