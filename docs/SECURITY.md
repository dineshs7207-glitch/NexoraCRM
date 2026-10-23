# Security foundation

- The browser uses only the Supabase anon key and authenticated Supabase sessions.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `REDIS_URL` through a `VITE_` variable.
- API routes must verify Supabase JWT signature, issuer, audience, and expiry before accessing data. Authorization must be enforced in the API and by Postgres RLS.
- Tables use RLS with owner/team/admin scope checks. The seed migration does not disable RLS.
- Production deployment must enforce HTTPS, secure cookies, rate limits, strict CSP, account lockout, and required TOTP for privileged roles.
