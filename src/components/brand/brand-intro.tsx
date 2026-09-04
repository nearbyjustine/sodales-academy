"use client";

import { useEffect, useState } from "react";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { SodalesMark } from "@/components/brand/sodales-mark";
import { INTRO_COOKIE } from "@/lib/brand/intro-cookie";

/**
 * The intro: the mark assembles from its own four cut pieces, the wordmark
 * wipes in beside it, then the screen parts along the same 26.2deg cut the mark
 * is built on.
 *
 * Two things it must not do:
 *
 * 1. Flash. It renders in the SSR HTML (a client component still prerenders),
 *    so it paints with the first frame rather than after hydration. Whether it
 *    renders at all is decided server-side from the `sodales_intro` cookie —
 *    see `BrandIntroGate` — so a returning visitor never sees a frame of it.
 * 2. Trap anyone. The whole timeline is CSS with `forwards` fill, so it clears
 *    itself with JavaScript disabled. React only adds the skip control and the
 *    cookie write on top.
 */
export function BrandIntro() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Session cookie (no Max-Age): plays once per browser session.
    document.cookie = `${INTRO_COOKIE}=1; path=/; SameSite=Lax`;
  }, []);

  if (dismissed) return null;

  return (
    <div className="brand-intro">
      <div aria-hidden="true">
        <div className="brand-intro__panel brand-intro__panel--lead" />
        <div className="brand-intro__panel brand-intro__panel--trail" />

        <div className="brand-intro__lockup">
          <SodalesMark className="brand-intro__mark" />
          <span className="brand-intro__wordmark">
            <BrandWordmark part="wordmark" tone="dark" />
          </span>
        </div>
      </div>

      <button type="button" className="brand-intro__skip" onClick={() => setDismissed(true)}>
        Skip intro
      </button>
    </div>
  );
}
