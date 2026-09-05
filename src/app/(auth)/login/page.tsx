import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-graphite">Sign in to Sodales Academy with your Google account.</p>
      </div>

      <GoogleButton />

      <p className="text-sm text-graphite">
        New to the Academy?{" "}
        <Link
          href="/sign-up"
          className="text-violet underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
