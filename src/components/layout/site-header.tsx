import Link from "next/link";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { MainNav } from "@/components/layout/main-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const session = await getSession();
  const showAdmin = session?.role === "instructor" || session?.role === "admin";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-ivory/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="shrink-0">
          <BrandWordmark product="Academy" />
        </Link>

        <MainNav showAdmin={showAdmin} />

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <RoleSwitcher current={session.role} />
              <span
                aria-hidden="true"
                className="label-eyebrow flex size-8 items-center justify-center rounded-md border border-border text-graphite"
              >
                {session.initials}
              </span>
            </>
          ) : null}
          <MobileNav showAdmin={showAdmin} />
        </div>
      </div>
    </header>
  );
}
