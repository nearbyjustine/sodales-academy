"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/courses", label: "Courses" },
];

/**
 * @param onNavigate Called when a link is followed. The mobile sheet passes its
 *   own close handler here. Previously these links were wrapped in `SheetClose`,
 *   which made Base UI treat each one as a button — it warned, and setting
 *   `nativeButton={false}` would have put role="button" on the anchor and
 *   overridden the link role.
 */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-violet",
              isActive ? "bg-secondary text-violet" : "text-graphite hover:bg-muted",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
