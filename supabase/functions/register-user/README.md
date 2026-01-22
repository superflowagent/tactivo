Register-user edge function

- Purpose: Create a new company, create an auth user, insert a `profiles` row (role=`professional`), and send a password reset email so the user can choose a password.
- Important: this function is intended to be callable without authentication from the public login page. When deploying, set `verify_jwt = false` (or equivalent) so the function does not require a token.

Behavior:

1. Expects POST JSON body: { email, centro, name, last_name, movil }
2. Normalizes `centro` to a `domain` (lowercase, spaces -> `-`, remove special chars) and ensures uniqueness by adding `-1`, `-2`, ... when needed.
3. Creates the `companies` row, then creates an auth user via `/auth/v1/admin/users` and inserts a `profiles` row with role `professional` and `company` set to the newly created company.
4. Sends a password-reset email via `/auth/v1/recover` redirecting to the `password-reset` function.
Note: For local testing, ensure the `APP_URL` environment variable is set to your frontend origin (eg. `http://127.0.0.1:5173`) when serving Functions (e.g., `supabase functions serve --env-file .env.local`). The `password-reset` function uses `APP_URL` to build the final redirect location; if it's unset or points to a different port (eg. `http://127.0.0.1:3000`), the email links may send users to the wrong host and the browser will fail to connect if that server isn't running.
Returns: `{ ok: true, company, profile, createUserResult, sendResult }` on success.
