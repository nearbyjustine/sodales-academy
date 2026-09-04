import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  /** Product half of the lockup, e.g. "Academy". Omit for the parent wordmark alone. */
  product?: string;
  /**
   * Surface the lockup sits on. "light" (default) uses the graphite wordmark;
   * "dark" swaps to the reversed artwork — the graphite wordmark is illegible
   * on Obsidian.
   */
  tone?: "light" | "dark";
  /**
   * "lockup" (default) is mark + wordmark. "wordmark" is the wordmark alone,
   * for the one place the mark is already on screen as its own element — the
   * intro animation, which assembles the lockup from its two halves.
   */
  part?: "lockup" | "wordmark";
  className?: string;
};

const ART = {
  lockup: {
    light: { src: "/brand/wordmark.png", width: 457, height: 100 },
    dark: { src: "/brand/wordmark-light.png", width: 457, height: 100 },
  },
  wordmark: {
    light: { src: "/brand/wordmark-text.png", width: 457, height: 50 },
    dark: { src: "/brand/wordmark-text-light.png", width: 457, height: 50 },
  },
} as const;

/**
 * The ONLY place the Sodales wordmark is rendered.
 *
 * Brand guidelines §4: the wordmark must ship as artwork and must never be set
 * as live text. Phase 1 uses the supplied PNG; when Rak delivers SVG this file
 * is the single point of change.
 *
 * The artwork is tight-cropped from the supplied 500x220 canvas so the `h-*`
 * class controls the real logo height rather than mostly-empty padding.
 */
export function BrandWordmark({
  product,
  tone = "light",
  part = "lockup",
  className,
}: BrandWordmarkProps) {
  const art = ART[part][tone];

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Image
        src={art.src}
        alt="Sodales"
        width={art.width}
        height={art.height}
        priority
        className={part === "wordmark" ? "h-3 w-auto" : "h-6 w-auto"}
      />
      {product ? (
        <>
          <span
            aria-hidden="true"
            className={cn("h-5 w-px", tone === "dark" ? "bg-ivory/30" : "bg-graphite/40")}
          />
          <span className={cn("label-eyebrow", tone === "dark" ? "text-ivory/70" : "text-graphite")}>
            {product}
          </span>
        </>
      ) : null}
    </span>
  );
}
