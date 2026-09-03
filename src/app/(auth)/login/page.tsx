import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-graphite">Sign in to Sodales Academy with your Google account.</p>
      </div>

      <GoogleButton />

      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="label-eyebrow text-graphite">or</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>

      <fieldset disabled className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input id="login-email" type="email" placeholder="you@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input id="login-password" type="password" placeholder="••••••••" />
        </div>
        <p className="text-sm text-graphite">Email sign-in arrives with the next release.</p>
      </fieldset>

      <p className="text-sm text-graphite">
        New to the Academy?{" "}
        <Link href="/sign-up" className="text-violet underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </div>
  );
}
