"use client";

import { useState } from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav({ showAdmin }: { showAdmin: boolean }) {
  // Controlled so the nav entries can stay plain <Link>s. Wrapping them in
  // SheetClose instead makes Base UI treat each one as a button — it warns, and
  // the documented `nativeButton={false}` escape hatch puts role="button" on the
  // anchor, which overrides the link role for screen readers. Closing the sheet
  // in onClick costs one state hook and keeps the links links.
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/courses", label: "Courses" },
    { href: "/dashboard", label: "Dashboard" },
    ...(showAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="md:hidden"
          />
        }
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="Main" className="flex flex-col gap-4 px-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="label-eyebrow text-graphite hover:text-violet"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
