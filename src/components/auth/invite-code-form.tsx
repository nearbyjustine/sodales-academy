"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyInviteCode } from "@/app/actions/verify-invite-code";

export function InviteCodeForm({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [verified, setVerified] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const result = await verifyInviteCode(code);

    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    setVerified(true);
    toast.success("Invite code accepted — continue with Google below.");
    onVerified();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-code">Invite code</Label>
        <Input
          id="invite-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={verified}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "invite-code-error invite-code-help" : "invite-code-help"}
        />
        <p id="invite-code-help" className="text-sm text-graphite">
          Members receive this from their team lead.
        </p>
        {error ? (
          <p id="invite-code-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={pending || verified}>
        {verified ? "Code accepted" : pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
