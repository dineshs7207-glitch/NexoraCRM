# Nexora CRM build check

Date: 2026-10-22

## Verification

- Web TypeScript check: passed (`pnpm --filter @nexora/web typecheck`). The root `pnpm typecheck` wrapper could not run because it invokes `npm`, which is not installed in this environment.
- Web production build: passed (`pnpm --filter @nexora/web build`).
- Earlier browser review: dashboard, leads, Sarah Wilson profile, deals, tasks, and calendar were checked in the running local app; dashboard KPI navigation, stage dialog, day/week/month activity filters, and calendar month view were confirmed.
- Current request's live browser verification: blocked because the existing browser tab was `file://` and the browser security policy refused access to it. The app changes therefore received a clean TypeScript + production build check, but ticket creation, invoice calculations/exports, theme switching, avatar upload, lead sorting, and assistant movement were not manually verified in the browser during this pass.
- No automated feature tests are configured in this workspace.
- Automated feature tests: none are configured in this workspace.

## Current data and integration boundary

- Lead, deal, task, calendar, email draft, settings, and audit demo data is saved in this browser's local storage.
- Excel import/export uses a browser-side spreadsheet parser. Import accepts `.xlsx`, `.xls`, and `.csv`, enforces the 10 MB / 50,000 row limits, validates email addresses, and skips duplicate emails.
- The Supabase browser client is configured from environment variables, but the hosted database migration has not been applied and screens do not yet load/save CRM records through Supabase.
- Authentication remains in demo-admin mode per the user's current setup preference. Employee login, admin-created credentials, and forced first-login password changes are deferred until the backend-only service key and first Supabase admin account are configured.
- Supabase authentication, server-side invitation emails, connected email/calendar providers, and WhatsApp delivery require backend/provider setup and are not represented as completed integrations.
- Profile photo, theme preference, tickets, invoices, lead tags, and activity updates are saved in this browser's local storage. Theme Auto follows the operating system/browser color-scheme preference.
- Invoice Word export creates an HTML-based `.doc` file for Word. PDF export opens the browser print dialog; the user must select Save as PDF.
- The movable assistant widget is a UI shell only; no model provider or API is connected, per the user's direction to add APIs later.
