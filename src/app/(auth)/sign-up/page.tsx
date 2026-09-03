import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { InviteCodeForm } from "@/components/auth/invite-code-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Join the Academy</h1>
        <p className="mt-2 text-graphite">Team members sign up with an invite code.</p>
      </div>

      <GoogleButton />

      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="label-eyebrow text-graphite">or</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>

      <InviteCodeForm />

      <p className="text-sm text-graphite">
        Already have an account?{" "}
        <Link href="/login" className="text-violet underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}
