---
title: Shipping Your First Site
module: Interactivity
isPreview: false
---

## Know what you are putting online

Hosting gives your built site a public place to run. A domain gives people a stable name to reach it. Keep access to the registrar, DNS records, source repository, and hosting project documented. For client work, agree who owns each account before launch; the client should not depend on your personal login to keep the site online.

This repository uses Next.js and pnpm. Before deploying, run the same local checks expected in production:

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

The build command catches problems that a development server may not expose. Fix errors rather than assuming the host will handle them differently.

## Deploy with Vercel

Vercel can connect to the Git repository, install dependencies, run the Next.js build, and publish the resulting deployment. Confirm that the project uses pnpm and that the build settings match the repository rather than copying settings from another project.

Each deployment receives a temporary URL. Use it as a review environment before attaching the client’s domain. Check:

- Primary navigation, forms, and error states
- Phone, tablet, and desktop widths
- Page titles, descriptions, icons, and social previews
- Images, fonts, and any environment variables
- Keyboard focus and visible focus styles

> A successful build proves that files compiled. It does not prove that the enquiry form reaches the correct person or that the supplied copy is current.

## Connect the domain carefully

Add the client’s domain to the hosting project, then create the DNS records the host requires. DNS changes can take time to appear across networks, so avoid promising an exact minute for the switch. Keep the previous site available until the new domain resolves reliably and the client has completed the launch check.

After launch, test the public address on a different network and submit one real enquiry with the client’s permission. Record where the domain is registered, who receives renewal notices, where the code lives, and how the client requests future changes. Hand over credentials through an agreed secure method, not an email containing a shared password.
