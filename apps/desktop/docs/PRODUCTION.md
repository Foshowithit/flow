# Flow Web — Production Guide

## Current Limitations

- **Custom domain**: `flow.optimizedworkflow.com` is not yet live. The app currently
  uses Vercel's default domain or a custom preview URL.
- **Clerk**: Production Clerk keys are not yet configured. The app uses development
  instance keys which may have rate limits.
- **Stripe**: Live Stripe secrets are not configured. Payments/subscriptions are in
  test mode only.
- **AI Provider**: API keys for DeepSeek (or OpenCode Go) must be set in production
  environment variables. BYOK (bring-your-own-key) support is implemented but
  requires a database row.
- **Service Worker**: No service worker is registered. Offline support requires
  additional implementation.
- **Session persistence**: Signed-in users have session/message persistence. Signed-out
  users get mock/demo responses only.
- **Authenticated QA blocked by Clerk dev-mode Cloudflare**: Production Clerk
  must be configured before authenticated end-to-end testing works outside of
  localhost.

## Approval-Gated Items

Before going to production, the following must be completed:

1. **Custom domain DNS** — Point `flow.optimizedworkflow.com` to Vercel.
2. **Production Clerk** — Create a production Clerk application and update env vars.
3. **Live Stripe** — Configure live Stripe secrets and webhook endpoints.
4. **Production DeepSeek/OpenCode Go keys** — Set in Vercel environment variables.
5. **Database migration** — Ensure migrations have been run against the production DB.

## Deployment

The app is deployed via Vercel. The entrypoint is `apps/web`.

### Environment Variables (Required)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app |
| `MOCK_CHAT` | Set to `true` for mock responses (dev only) |
| `DEEPSEEK_API_KEY` or `OPENCODE_GO_API_KEY` | AI provider API key |

### Admin Environment Variables

| Variable | Description |
|---|---|
| `ADMIN_CLERK_IDS` | Comma-separated list of Clerk user IDs granted admin access (bypasses DB role check) |
| `ADMIN_EMAILS` | Comma-separated list of email addresses granted admin access (bypasses DB role check) |

At least one user must have `role = 'admin'` in the database, or the Clerk ID / email
must be listed in `ADMIN_CLERK_IDS` / `ADMIN_EMAILS` for admin access to work.

### Database Migration

Run the migration against the target database:

```bash
# Ensure DATABASE_URL is set to the target database
npx tsx scripts/migrate.ts
```

This is idempotent — safe to run multiple times. It will:

- Create tables if they don't exist (users, subscriptions, api_keys, usage_records,
  chat_sessions, chat_messages, waitlist, chat_session_summaries)
- Add columns if missing (archived_at, deleted_at, session_id, role, beta_status)
- Create indexes if missing

### Health Check

`GET /api/health` returns JSON with `status`, `timestamp`, `app`, `mockChat`,
`aiConfigured`, and `dbReachable`. Use this for monitoring.

`GET /api/admin/health` (admin-only) returns additional env flag presence checks.

### Smoke Tests

```bash
BASE_URL=https://your-deployment.url npm run smoke
```

Exits nonzero if any check fails.

## Admin Panel

The admin panel is available at `/admin` for users with admin privileges.

### Admin APIs

| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/users` | GET | List users with email/name, role, beta_status, created_at, session/message counts, usage counts/cost |
| `/api/admin/usage` | GET | Aggregate usage records by day/model and totals |
| `/api/admin/health` | GET | Deep health check — db, env flags, mockChat, aiConfigured, clerkWebhookSecret |

All admin APIs return 401 (not signed in) or 403 (not admin) for unauthorized requests.

### Granting Admin Access

Two ways to grant admin access (checked in order):

1. **Environment variables** (fastest, no DB change):
   - Set `ADMIN_CLERK_IDS` with comma-separated Clerk user IDs
   - Set `ADMIN_EMAILS` with comma-separated email addresses

2. **Database role** (persistent):
   - Run `UPDATE users SET role = 'admin' WHERE email = 'user@example.com';`
   - Then run migration if the `role` column doesn't exist yet

## Production Clerk Checklist

Before enabling production Clerk:

1. **Create production Clerk application** at https://dashboard.clerk.com
2. **Configure domain** — Add `flow.optimizedworkflow.com` (or your custom domain) to the
   Clerk application's allowed origins.
3. **Copy production keys** — Update Vercel env vars:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
4. **Set webhook endpoint** in Clerk dashboard pointing to:
   `https://your-domain.com/api/webhooks/clerk`
5. **Set webhook signing secret** (`CLERK_WEBHOOK_SECRET`) in Vercel env vars
6. **Update Clerk URLs** if customizing:
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
   - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`
7. **Remove development instance keys** from all environments
8. **Verify** — Authenticated QA (Playwright tests, session persistence, streaming)
   will not work until production Clerk is live.

## Backup and Restore

### Backup Command

Exports critical tables (users, chat_sessions, chat_messages, chat_session_summaries,
usage_records, waitlist) to local JSON files. Excludes api_keys.
Secrets in exported data are automatically redacted.

```bash
# Requires DATABASE_URL environment variable
npm run backup:neon
```

Output directory: `./backups/flow-backup-YYYYMMDD-HHMMSS/`
Contains one JSON file per table plus a README.json manifest with row counts.

### Restore Note

The JSON exports are for inspection/snapshot only. To restore:
- Use `psql` or the Neon console to import the JSON data back.
- For full database restore, use Neon's automated backups or `pg_dump`.
- After any restore, run the migration: `npx tsx scripts/migrate.ts`

### Limitations

- The backup script does **not** use `pg_dump` by default (avoids secrets in process lists).
- Exports are point-in-time snapshots, not incremental.
- The `api_keys` table is intentionally excluded.
- Secrets in string values are redacted (truncated to first/last 4 chars).

## QA Checklist

- [ ] Landing page loads without scroll blocking
- [ ] `/chat` works for signed-out users (shows sign-in prompt + demo)
- [ ] `/chat` works for signed-in users (real chat composer)
- [ ] Conversation search works (sidebar search box + API)
- [ ] Waitlist form handles duplicate emails gracefully (informational, not red)
- [ ] 404 page shows Flow branding with navigation links
- [ ] Health endpoint returns expected JSON
- [ ] Admin page shows sign-in CTA when signed out
- [ ] Admin page shows "not admin" when signed in without privileges
- [ ] Admin APIs return 401/403 for unauthorized access
- [ ] Lint passes: `npm run lint`
- [ ] Typecheck passes: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] Smoke tests pass: `npm run smoke`

## Runbook

### Chat API returns 500

1. Check Vercel function logs for stack trace.
2. Verify `DATABASE_URL` and AI provider API keys are set.
3. Check if `chat_sessions` and `chat_messages` tables exist (run migration).

### Users can't sign in

1. Verify Clerk keys are correct and the instance is in production mode.
2. Check Vercel env vars for `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
3. Verify webhook endpoint is configured in Clerk dashboard.

### Database connectivity issues

1. Verify `DATABASE_URL` is correct and the Neon project is active.
2. Check IP allowlist if the Neon plan restricts access.
3. Run `SELECT 1` directly to confirm connectivity.

### Admin access not working

1. Verify user is signed in (Clerk session active).
2. Check `ADMIN_CLERK_IDS` or `ADMIN_EMAILS` environment variables are set correctly.
3. Check database `users.role` column exists (run migration).
4. Run `UPDATE users SET role = 'admin' WHERE email = '...'` to grant DB-level admin.
