"use client";

import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The admin sheet, extracted from `admin/layout.tsx` so its open state can be
 * controlled. That lets `AdminNav` render plain links and close the sheet in
 * `onClick`, instead of wrapping each one in `SheetClose` and inheriting button
 * semantics it shouldn't have.
 */
export function AdminMobileNav({ role }: { role: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Admin</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
          <AdminNav onNavigate={() => setOpen(false)} />
          <p className="label-eyebrow text-graphite">Signed in as {role}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
