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

IMPORTANT: test the migration in a dev project before applying to production. The trigger inserts directly into `auth.users` and requires elevated privileges (service role or an authenticated CLI session).

