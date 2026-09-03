"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteCodeForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (code.trim() === "") {
      setError("Enter your invite code.");
      return;
    }

    setError(null);
    toast.info("Sign-in isn't wired up yet.");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-code">Invite code</Label>
        <Input
          id="invite-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby="invite-code-help"
        />
        <p id="invite-code-help" className="text-sm text-graphite">
          Members receive this from their team lead.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full">
        Join with invite code
      </Button>
    </form>
  );
}
