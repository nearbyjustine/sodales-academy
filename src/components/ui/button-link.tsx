import Link from "next/link";
import { type VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A navigation control that looks like a button.
 *
 * Use this instead of `<Button render={<Link />}>`. Base UI's `Button` assumes
 * it wraps a native `<button>` and warns when it doesn't; the documented escape
 * hatch, `nativeButton={false}`, swaps `type="button"` for **`role="button"`**
 * (see `useButton`'s `isNativeButton ? { type: 'button' } : { role: 'button' }`).
 * On an `<a href>` that overrides the implicit link role: a screen reader
 * announces it as a button, it drops out of the links rotor, and the
 * open-in-new-tab affordance stops being advertised.
 *
 * These controls navigate, so they should stay links. Only the styling is
 * shared, through `buttonVariants` — which is exactly what that export is for.
 *
 * `Button` is still correct for anything that actually acts on the page:
 * submits, dialog triggers, menu triggers, sign-out.
 */
function ButtonLink({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link
      data-slot="button-link"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { ButtonLink };
