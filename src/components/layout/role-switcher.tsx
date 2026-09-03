"use client";

import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setRole } from "@/app/actions/set-role";
import { resetProgress } from "@/lib/progress";
import type { Role } from "@/lib/session";

const ROLES: { value: Role; label: string }[] = [
  { value: "learner", label: "Learner" },
  { value: "instructor", label: "Instructor" },
  { value: "admin", label: "Admin" },
];

export function RoleSwitcher({ current }: { current: Role }) {
  const router = useRouter();

  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  async function handleSelectRole(role: Role) {
    await setRole(role);
    router.refresh();
  }

  function handleResetProgress() {
    resetProgress();
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Demo role switcher"
        className="label-eyebrow rounded-md border border-violet px-2.5 py-1.5 text-violet"
      >
        DEMO · {current}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {ROLES.map((role) => (
          <DropdownMenuItem key={role.value} onClick={() => handleSelectRole(role.value)}>
            {role.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleResetProgress}>Reset demo progress</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
