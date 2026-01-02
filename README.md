# CRM Fisioterapia

Changelog (recent cleanup)
- chore: removed temporary scripts used for migrations and debugging
- chore: removed debug logs and tightened auth/company URL handling
- chore: unified datetime handling to preserve wall-clock times when updating events
- chore: removed unused imports and fixed linting warnings

Sistema de gesti�n para cl�nicas de fisioterapia en desarrollo.

## Stack

- React + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Supabase

## Supabase setup

Create a `.env.local` file (not committed) with the following variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your_public_key
# Use service role key only temporarily for data migration:
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```
## Admin endpoint: create user

A serverless endpoint is provided at `api/admin/create-user` which:
- creates an `auth.user` using the Service Role Key
- upserts a `profiles` row linking to the user
- sends a password-reset email (so the user sets its password)
- records an audit in `user_creation_audit`

Security:
- The endpoint requires header `x-admin-secret` equal to `ADMIN_SECRET` env var (set in your deployment)
- Set `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `ADMIN_SECRET` and `RESET_REDIRECT_URL` in your Vercel project secrets before deploying.
## Applying RLS & triggers

I added migration SQL in `supabase/migrations/001_profiles_trigger_and_rls.sql` that:
- Adds a BEFORE INSERT trigger on `public.profiles` to create an `auth.users` row when a profile is inserted without `user_id`.
- Enables RLS and creates initial policies for `profiles`, `events`, `companies`, `exercises`, `anatomy`, `equipment`, and `classes_template`.

To apply the migrations locally using the Supabase CLI:
1. Install supabase CLI: https://supabase.com/docs/guides/cli
2. Log in: `supabase login`
3. Run the provided PowerShell script: `.
scripts\apply-supabase-migrations.ps1 -ProjectRef <your-project-ref>`

Rollbacks are available in `supabase/migrations/001_profiles_trigger_and_rls_rollback.sql`.

Additional migration: `supabase/migrations/002_events_policies.sql` adds RLS policies allowing authenticated company members (professionals/admins) to select/insert/update/delete events belonging to their company. A rollback is provided at `supabase/migrations/002_events_policies_rollback.sql`.

IMPORTANT: test the migrations in a dev project before applying to production. Some operations require elevated privileges (service role or an authenticated CLI session).

New features added:
- Edge Function `send-invite` (deployed) — generates `invite_token`, updates `profiles` and returns an `invite_link`; attempts to send a password-reset email via the Supabase REST `/auth/v1/recover` endpoint using the Service Role key (no npm dependency required).
- Serverless admin endpoint `api/admin/delete-user` — deletes a `profiles` row and deletes the linked auth user (if any). Accepts either `x-admin-secret` or a Bearer token from an authenticated admin (same company). Use from UI delete flows for professionals/clients.
- RPC `accept_invite(p_token text)` (SECURITY DEFINER) — links an authenticated user (auth.uid()) to a `profiles` row identified by `invite_token` and clears the token fields. Migration: `supabase/migrations/007_accept_invite_function.sql`.

Fixes & notes:
- Fixed a type mismatch (UUID vs text) in `accept_invite` that caused an `invalid input syntax for type json` / operator errors when called as an authenticated user. Migration: `supabase/migrations/017_fix_accept_invite_type_mismatch.sql`.
- Added diagnostic helpers (e.g. `accept_invite_verbose`, `dbg_accept_invite_sim`) used during debugging. These are safe to keep but can be removed if you prefer a clean schema.

- Frontend route `/accept-invite` (`src/components/views/AcceptInviteView.tsx`) — page to accept the invite (click the button once you are authenticated after following the password-reset flow).
- E2E test script: `scripts/e2e/invite-flow.cjs` — runs a full invite cycle if you set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `VITE_SUPABASE_ANON_KEY` in your environment and run `node scripts/e2e/invite-flow.cjs`.


