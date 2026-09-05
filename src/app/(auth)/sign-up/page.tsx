import type { Metadata } from "next";
import Link from "next/link";
import { SignUpFlow } from "@/components/auth/sign-up-flow";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Join the Academy</h1>
        <p className="mt-2 text-graphite">Team members sign up with an invite code.</p>
      </div>

      <SignUpFlow />

      <p className="text-sm text-graphite">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-violet underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
