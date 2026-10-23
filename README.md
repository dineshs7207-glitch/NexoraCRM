# Nexora CRM

Responsive CRM demo built with React, TypeScript, Vite, MUI, Recharts, and Supabase client configuration. The screens follow the supplied Nexora CRM mockups and include dashboard, leads and lead profiles, deals pipeline, contacts, tasks, calendar, email drafts, reports, users, import, audit log, and settings.

## Run locally

Requirements: Node.js 20+ and pnpm.

```powershell
pnpm install
pnpm --filter @nexora/web dev
```

Open the local address printed by Vite. In this Windows workspace, `http://127.0.0.1:5173/` is the working address.

## GitHub Pages

The `main` branch runs CI on pushes and pull requests. Pushes to `main` also build and deploy the web app to GitHub Pages at `https://dineshs7207-glitch.github.io/NexoraCRM/`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The first deployment requires repository Pages permission to be enabled.

This is a static demo deployment: records are kept in each browser's local storage. Supabase credentials and a production backend are not configured by this workflow.

## Demo behavior

CRM sample data and edits are stored in browser local storage. Excel/CSV import parses files locally, validates email addresses, and skips duplicate addresses. Reports can be exported to Excel; PDF export opens the browser print dialog. Email replies are saved as drafts, and contact sharing opens a WhatsApp draft for the user to review.

The Supabase public project URL and publishable key are read from `apps/web/.env.local` (`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`). The app currently initializes the Supabase browser client but the hosted schema migration is not deployed and the CRM screens use local demo data. Do not place a service-role key in frontend environment variables. Do not claim that email, calendar, invitation, or WhatsApp providers are connected until their server-side credentials and flows are configured.

## Checks

```powershell
pnpm --config.store-dir=.pnpm-store --recursive --if-present run typecheck
pnpm --config.store-dir=.pnpm-store --filter @nexora/web run build
```

See [docs/TEST_REPORT.md](docs/TEST_REPORT.md) for the latest build and integration status.
