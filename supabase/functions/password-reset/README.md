Password Reset exchange function

This Edge Function exchanges a TokenHash (access_token / TokenHash from Supabase email templates) for a real session and redirects the user to the app with the session tokens in the fragment.

Usage:
- Email template: use `{{ .SiteURL }}/functions/password-reset?access_token={{ .TokenHash }}` (or call this endpoint directly with the token as `access_token` or `token`).
- The function will call `supabase.auth.verifyOtp({ token, type: 'recovery' })` using the Service Role key.
- If Supabase returns session tokens, the function redirects to `${APP_URL}/auth/password-reset#access_token=...&refresh_token=...` so the SPA can parse and create the session.
- If the exchange does not return tokens, it redirects to `${APP_URL}/auth/password-reset?token=<token>` as a fallback.

Environment variables required:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- APP_URL (optional; if missing, function uses request origin)

Security notes:
- Prefer rendering the final redirect with tokens in the URL fragment (`#`) — fragments are not sent to servers or logs.
- Avoid putting access tokens in query strings if possible in production (they can end up in logs). If you must, make sure to use HTTPS and take measures to limit logging.

Deploying & troubleshooting (NOT_FOUND)

If you open the function URL and see `{"code":"NOT_FOUND","message":"Requested function was not found"}` this means the function has not been deployed to the Supabase project or it's deployed under a different name.

Quick deploy checklist:
1. Install & login to Supabase CLI if not already:
   - `npm i -g supabase` or use the installer from https://supabase.com/docs/guides/cli
   - `supabase login`

2. From the project root, link or confirm your project ref (optional but helpful):
   - `supabase link --project-ref <your-project-ref>`

3. Deploy the function (name must be `password-reset` to match the URL path):
   - `supabase functions deploy password-reset --project-ref <your-project-ref>`

4. Set required secrets on the project (if not set already):
   - `supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>" --project-ref <your-project-ref>`
   - `supabase secrets set APP_URL="https://your-app-url" --project-ref <your-project-ref>`

5. Verify the function exists and view logs:
   - `supabase functions list --project-ref <your-project-ref>`
   - `supabase functions logs password-reset --project-ref <your-project-ref>`

Local testing (optional):
- `supabase functions serve password-reset` will run the function locally (requires CLI and an up-to-date runtime).

If you prefer that the server establishes an HTTP-only cookie session instead of returning tokens in the fragment, I can modify the function to set cookies in the response (requires writing cookies from the Edge Function and slightly different server-side client behavior).

