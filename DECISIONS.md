# Decisions

- Phase 1 is implemented as a local monorepo foundation; no Supabase project credentials were provided. Database migrations and client integration points are included, while cloud provisioning, email invitations, mandatory TOTP enrollment, and production cookie/session exchange must be connected to the chosen project before deployment.
- Supabase Auth issues the user JWT. The API validates it using the Supabase project's JWKS endpoint; service role credentials are server-only.
- Seed data is limited to reference pipeline stages and does not create fake employee accounts or customer records.
- Redis is an optional API-side cache dependency and must never be accessed from the browser.
- Supabase is the auth provider and database (project `bescvqmyrwyzcszpymcb`). The web app signs in with supabase-js (password, plus magic links with `shouldCreateUser: false`); the API verifies the same JWTs with `@supabase/server/core` (`verifyCredentials`, then `createContextClient` so row level security applies). There is no Fastify adapter, and the package's framework adapters are deprecated, so the API uses the core helpers directly.
- One role set everywhere: `owner`, `admin`, `manager`, `sales_rep`, `viewer`. The database enum was migrated (`employee` → `sales_rep`, `owner` added); owners have admin rights in every policy via `public.is_admin()`.
- Only invited accounts get a profile: the `on_auth_user_created` trigger skips users without `invited_at`, so someone who signs up on their own (or clicks Google uninvited) sees nothing. Role, team and scope are set by the `invite-user` edge function with the secret key, never from user metadata (users can edit their own). It runs with `verify_jwt = false` because the project signs tokens with asymmetric keys; `@supabase/server` checks the caller's JWT and that they are an active owner or admin.
- CRM records stay in browser storage for now. The signed-in profile becomes the workspace's current user so scope rules already follow the real role; moving records into Supabase tables is the next step.
- The secret key is server-only and lives in the gitignored root `.env`. The publishable key is safe to ship to the browser.
