import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  /** Product half of the lockup, e.g. "Academy". Omit for the parent wordmark alone. */
  product?: string;
  className?: string;
};

/**
 * The ONLY place the Sodales wordmark is rendered.
 *
 * Brand guidelines §4: the wordmark must ship as artwork and must never be set
 * as live text. Phase 1 uses the supplied PNG; when Rak delivers SVG this file
 * is the single point of change.
 */
export function BrandWordmark({ product, className }: BrandWordmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Image
        src="/brand/wordmark.png"
        alt="Sodales"
        width={120}
        height={53}
        priority
        className="h-4 w-auto"
      />
      {product ? (
        <>
          <span aria-hidden="true" className="h-4 w-px bg-graphite/40" />
          <span className="label-eyebrow text-graphite">{product}</span>
        </>
      ) : null}
    </span>
  );
}
