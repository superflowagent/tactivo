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

### Crear nuevas Edge Functions ⚙️

Para crear una nueva edge function y que su entrada en `supabase/config.toml` tenga `verify_jwt = false` por defecto, usa:

```
npm run new:function -- <nombre-de-la-funcion>
```

Esto creará `supabase/functions/<nombre-de-la-funcion>/index.ts` y añadirá automáticamente la entrada en `supabase/config.toml` con `verify_jwt = false`.

---

## Administrar secretos y migraciones (prod vs local) 🔒

- En producción **usa `supabase secrets set`** para poner valores sensibles (por ejemplo `ADMIN_SECRET`) en el proyecto remoto. Ejemplo:

  supabase secrets set ADMIN_SECRET=sb_secret_xxx --project-ref <your-project-ref>

- En local tienes dos opciones válidas:
  - **Preferida**: usar `supabase secrets set ADMIN_SECRET=...` (se inyectará en los runtimes locales y será leída por las functions vía `Deno.env.get('ADMIN_SECRET')`).
  - **Fallback controlado**: si la env var no está disponible (por ejemplo en entornos donde no se inyectan secrets), las functions intentarán leer **`public.app_settings`** usando la Service Role Key. Para crear la fila localmente (solo dev):

    curl -sS -X POST "http://127.0.0.1:54321/rest/v1/app_settings" \
      -H "apikey: $SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -d '{"key":"ADMIN_SECRET","value":"sb_secret_..."}'

  Esto permite que local y prod compartan la misma lógica de lectura (production prioriza `Deno.env`).

- Migraciones limpias: cuando vayas a pasar a prod con `supabase db push --project-ref` y `supabase functions deploy --project-ref`, asegúrate de incluir las migraciones versionadas en `supabase/migrations` (ya añadí las necesarias para `app_settings`, trigger y backfill). Las migraciones son idempotentes y diseñadas para ser seguras tanto en local como en producción.

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
- Removed diagnostic helper migrations and debug scripts used during development.

- Frontend route `/accept-invite` (`src/components/views/AcceptInviteView.tsx`) — page to accept the invite (click the button once you are authenticated after following the password-reset flow).
- E2E test script: `scripts/e2e/invite-flow.cjs` — runs a full invite cycle if you set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `VITE_SUPABASE_ANON_KEY` in your environment and run `node scripts/e2e/invite-flow.cjs`.
