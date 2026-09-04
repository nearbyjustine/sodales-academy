"use client";

import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  async function handleClick() {
    const { authClient } = await import("@/lib/auth/client");
    await authClient.signOut();
    window.location.href = "/";
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={handleClick}>
      <LogOutIcon />
    </Button>
  );
}
