import { cn } from "@/lib/utils";

/**
 * The Sodales mark as inline SVG, traced from the supplied `mark.png` artwork.
 *
 * Four pieces, in the order the mark is built: two inner arrow bars that point
 * through the centre, and two outer hooks that close around them. They carry
 * `data-piece` so the intro animation can move each one along its own axis —
 * see `brand-intro.tsx` and the `intro-*` keyframes in `globals.css`.
 *
 * This is the MARK, not the wordmark. The wordmark still renders only through
 * `<BrandWordmark />` as artwork (brand guidelines §4).
 */
export function SodalesMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn("text-violet", className)}
    >
      <path
        data-piece="bar-in"
        d="M28.98 48.86 L32.95 33.52 L63.64 25.57 L58.52 18.75 L65.34 17.05 L77.84 14.77 L96.02 32.95 L94.89 34.09 L36.36 48.3 L31.25 49.43 Z"
      />
      <path
        data-piece="bar-out"
        d="M3.98 66.48 L71.02 50.57 L67.05 66.48 L36.36 74.43 L41.48 81.25 L34.66 82.95 L22.16 85.23 Z"
      />
      <path
        data-piece="hook-top"
        d="M0 56.25 L11.36 11.36 L56.82 0 L51.7 17.61 L23.86 24.43 L16.48 52.84 L2.27 56.82 Z"
      />
      <path
        data-piece="hook-bottom"
        d="M43.18 98.3 L48.3 82.39 L76.14 75.57 L83.52 47.16 L100 43.18 L88.64 88.64 L43.75 100 Z"
      />
    </svg>
  );
}
