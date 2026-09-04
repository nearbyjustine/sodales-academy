"use client";

import { useState } from "react";
import { GoogleButton } from "@/components/auth/google-button";
import { InviteCodeForm } from "@/components/auth/invite-code-form";

export function SignUpFlow() {
  const [verified, setVerified] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <InviteCodeForm onVerified={() => setVerified(true)} />
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="label-eyebrow text-graphite">then</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton disabled={!verified} />
    </div>
  );
}
