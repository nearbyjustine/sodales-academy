"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ROLE_COOKIE, type Role } from "@/lib/session";

export async function setRole(role: Role) {
  const store = await cookies();
  store.set(ROLE_COOKIE, role, { path: "/", httpOnly: false, sameSite: "lax" });
  revalidatePath("/", "layout");
}
