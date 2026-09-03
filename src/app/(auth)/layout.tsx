import Link from "next/link";
import { BrandWordmark } from "@/components/brand/brand-wordmark";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-flex">
            <BrandWordmark product="Academy" />
          </Link>
          {children}
        </div>
      </div>

      <div className="hidden flex-col justify-center bg-deep-ink px-16 text-ivory lg:flex">
        <p className="text-4xl leading-tight font-bold tracking-tight">
          Creative Intelligence. Collective Impact.
        </p>
        <p className="mt-4 max-w-sm text-ivory/70">
          SODALES is a modern creative intelligence collective where strategy, design &
          technology converge.
        </p>
      </div>
    </div>
  );
}
