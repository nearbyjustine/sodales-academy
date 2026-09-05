export type SiteNavLink = { href: string; label: string };

/**
 * Canonical site nav destinations, shared by `MainNav` (desktop) and `MobileNav`
 * (mobile sheet) so the two can never drift — see
 * docs/qa/2026-09-05-frontend-qa.md B2. Each caller still owns its own markup
 * (active-state styling on desktop, close-on-click in the mobile sheet); only
 * the link data is shared.
 */
export function getSiteNavLinks(showAdmin: boolean): SiteNavLink[] {
  return [
    { href: "/tracks", label: "Tracks" },
    { href: "/courses", label: "Courses" },
    { href: "/dashboard", label: "Dashboard" },
    ...(showAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
}
