# Sodales Project Guidelines

Welcome to the Sodales collective monorepo. This repository hosts six independent applications (Main portfolio, Academy, Persona, Cinema, Talents, Store) built with a shared UI foundation but fully isolated runtime, data, and authentication.

## 🏗️ Project Structure

```
sodales/
├── apps/
│   ├── main/       (port 3000, no DB)
│   ├── academy/    (port 3001, sodales-academy)
│   ├── persona/    (port 3002, sodales-persona)
│   ├── cinema/     (port 3003, sodales-cinema)
│   ├── talents/    (port 3004, sodales-talents)
│   └── store/      (port 3005, sodales-store)
├── packages/
│   └── ui/         (shadcn/ui primitives + design tokens)
└── docs/           (SDDs and project documentation)
```

## 🛠️ Technology Stack

- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS + `packages/ui` (shadcn/ui)
- **Database**: Neon Serverless Postgres
- **ORM**: Drizzle ORM
- **Authentication**: Neon Auth (managed Better Auth)
- **Package Manager**: pnpm + Turborepo

## 📚 Coding Guidelines & Architecture

Please refer to `docs/coding-guidelines.md` for a comprehensive breakdown of our architectural contracts, data conventions, and UI standards. For specific app architectures, refer to the SDDs in `docs/` (e.g., `docs/00-platform.md`, `docs/02-academy.md`).

## 🚀 Common Commands

- `make dev`: Start all applications locally.
- `make build`: Build the monorepo.
- `make lint` / `make typecheck`: Run quality gates.
- `make db-migrate APP=<app>`: Apply Drizzle migrations for a specific app.

## 🏆 Context (The Playbook PH)

This platform supports The Playbook PH competition, where teams compete across 4 tasks:
- 🚀 Freelancing Agency
- 🎬 Short Film/Commercial Video
- 💻 Digital Products
- 🎨 Full Branding

*Note: The Academy is currently open for team members, but is architected to scale to the public long-term.*
