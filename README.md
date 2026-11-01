# Nexora

Sales platform for the Nexora team: pipeline (deals and leads), customers with full client history, schedule, finance (quotes, invoices, payments), growth reports, onboarding projects, an inbox and a working automation engine. Structure and labels follow the sales reference in [docs/SOLVIK_REFERENCE.md](docs/SOLVIK_REFERENCE.md); interaction patterns come from [docs/CORBEL_REFERENCE_ANALYSIS.md](docs/CORBEL_REFERENCE_ANALYSIS.md). All code and styles are our own. QA notes: [docs/QA_REVIEW.md](docs/QA_REVIEW.md).

**Status: Phase 3 started.** Sign-in and user profiles run on Supabase (project `bescvqmyrwyzcszpymcb`). CRM records still live as sample data in the browser until they move to the database, so don't enter real customer data yet.

## Run locally

Requirements: Node.js 22+ and pnpm 9.

```powershell
pnpm install
copy .env.example .env                  # then fill in the server values (secret key from Supabase → API Keys)
# apps/web/.env.local needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
pnpm --filter @nexora/web dev           # http://localhost:5173/
pnpm --filter @nexora/api dev           # http://localhost:4000/health, /me
```

Without the `VITE_SUPABASE_*` values the web app skips sign-in and runs as an open preview on sample data (this is what GitHub Pages shows unless the repository variables are set).

## Supabase

Migrations live in `supabase/migrations`. Apply them to the hosted project with the Supabase CLI:

```powershell
npx supabase login
npx supabase link --project-ref bescvqmyrwyzcszpymcb
npx supabase db push
```

Accounts are invite-only. Add `http://localhost:5173/**` and `https://dineshs7207-glitch.github.io/NexoraCRM/**` under **Authentication → URL Configuration**, then deploy the invite function:

```powershell
npx supabase functions deploy invite-user --no-verify-jwt
```

Owners and admins invite people from **Settings → Team & roles → Invite teammate**. The `invite-user` edge function creates the account, sets the role, team and data scope, and emails a link to choose a password. Supabase's built-in mailer only reaches the project's own members, so until custom SMTP is set up (**Authentication → Emails → SMTP Settings**) the app shows the invite link to copy and send yourself. Sign-up stays switched on so invited people can also arrive through Google, but only invited accounts get a `profiles` row; anyone else signs in to an empty "Can't open Nexora" screen. Promote someone in the SQL editor:

```sql
update public.profiles set role = 'owner', scope = 'all' where work_email = 'you@example.com';
```

People sign in with Google, a password or an emailed one-time link; Google sign-in joins the account with the same email. Invite and reset links land on a "Choose a password" screen.

Roles are `owner`, `admin`, `manager`, `sales_rep` and `viewer` in the database, API (`apps/api/src/permissions.ts`) and app alike; `packages/shared` holds the shared types and labels.

## What's in the app

| Area | Route | Highlights |
|---|---|---|
| Overview | `#/overview` | Won, pipeline, win rate, deal size; revenue vs monthly target; hot deals by weighted value; team quota with "needs ₹X a day"; stage mix; leaderboard; today's agenda; recent activity |
| Pipeline | `#/pipeline/:id?`, `#/leads/:id?` | Deals / Leads switch; board (drag and drop, or Move on phones) and list; include won & lost; stage stepper; lead conversion |
| Customers | `#/customers/:id?`, `#/contacts/:id?` | Accounts / Contacts; 360° customer page with lifetime value, revenue, deals, invoices, notes, conversations, timeline |
| Schedule | `#/schedule` | Month/week calendar of calls, meetings, tasks and emails; per-rep and type filters; day agenda |
| Finance | `#/finance/:id?` | Cash flow, aging, invoices and quotes, payments, printable A4 PDF with CGST/SGST |
| Growth | `#/growth` | Period reports, funnel, rep leaderboard, new customers, win-rate trend, top customers, lead sources, activity heatmap |
| Projects | `#/projects/:id?` | Onboarding projects created automatically when a deal is won |
| Inbox | `#/inbox/:id?` | Chat-style threads with auto-growing composer and quick replies |
| Automations, Tasks, Products | dock | Automation builder with test runs; task board; product catalogue |
| Settings | `#/settings/:tab` | Theme and palettes (Lime default), company, currencies, team and roles, notifications, audit log, data |

Press **Ctrl+K** anywhere to search records and jump to pages.

### Multi-currency

Accounts, deals, products, quotes and invoices each carry their own currency (INR, USD, EUR, GBP, AED, SGD). Dashboards and reports convert to the base currency using the rates in Settings → Company.

### Roles

Owner and Admin see everything. Managers see their team, Sales reps see only their own records, and Viewers are read-only. Your role comes from your Supabase profile. Settings → Team → **View as** still lets you check what each role sees in this browser; the database enforces the same rules with row level security as records move to Supabase.

### Invoice download

**Download PDF** opens a print-ready A4 page and the browser's *Save as PDF* writes the file, named after the invoice number. Phase 4 replaces this with PDFs generated on the server and served from expiring links.

## Code layout

```
apps/web/src
  data/        types, seed, store (commit + events), actions, access (roles/scope), metrics, automation engine
  features/    one folder per screen
  shell/       app frame, navigation, dock, Ctrl+K palette
  ui/          primitives (sheet, modal, table, KPI tile…) and SVG charts
  styles/      design tokens (light/dark + palettes) and component styles
  lib/         formatting, CSV export, theme preferences
```

## Checks

```powershell
pnpm --filter @nexora/web typecheck
pnpm --filter @nexora/web build
pnpm --filter @nexora/api typecheck
```

## GitHub Pages

Pushes to `main` build and deploy the web app to `https://dineshs7207-glitch.github.io/NexoraCRM/` (hash routes keep deep links working on static hosting).
