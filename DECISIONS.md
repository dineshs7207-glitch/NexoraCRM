# Decisions

- Phase 1 is implemented as a local monorepo foundation; no Supabase project credentials were provided. Database migrations and client integration points are included, while cloud provisioning, email invitations, mandatory TOTP enrollment, and production cookie/session exchange must be connected to the chosen project before deployment.
- Supabase Auth issues the user JWT. The API validates it using the Supabase project's JWKS endpoint; service role credentials are server-only.
- Seed data is limited to reference pipeline stages and does not create fake employee accounts or customer records.
- Redis is an optional API-side cache dependency and must never be accessed from the browser.
