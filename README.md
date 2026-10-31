# Nexora

Sales platform for the Nexora team: pipeline (deals and leads), customers with full client history, schedule, finance (quotes, invoices, payments), growth reports, onboarding projects, an inbox and a working automation engine. Structure and labels follow the sales reference in [docs/SOLVIK_REFERENCE.md](docs/SOLVIK_REFERENCE.md); interaction patterns come from [docs/CORBEL_REFERENCE_ANALYSIS.md](docs/CORBEL_REFERENCE_ANALYSIS.md). All code and styles are our own. QA notes: [docs/QA_REVIEW.md](docs/QA_REVIEW.md).

**Status: Phase 2 preview.** Every screen works on sample data stored in the browser. Login, the PostgreSQL database and server-generated PDFs arrive in Phases 3–4 on Hostinger. Don't enter real customer data yet.

## Run locally

Requirements: Node.js 20+ and pnpm 9.

```powershell
pnpm install
pnpm --filter @nexora/web dev
```

Open `http://localhost:5173/`.

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

Owner and Admin see everything. Managers see their team, Sales reps see only their own records, and Viewers are read-only. In this preview, Settings → Team → **View as** lets you check what each role sees; the server enforces the same rules from Phase 3.

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
```

## GitHub Pages

Pushes to `main` build and deploy the web app to `https://dineshs7207-glitch.github.io/NexoraCRM/` (hash routes keep deep links working on static hosting).
