Register-user edge function

- Purpose: Create a new company, create an auth user, insert a `profiles` row (role=`professional`), and send a password reset email so the user can choose a password.
- Important: this function is intended to be callable without authentication from the public login page. When deploying, set `verify_jwt = false` (or equivalent) so the function does not require a token.

Behavior:
1. Expects POST JSON body: { email, centro, name, last_name, movil }
2. Normalizes `centro` to a `domain` (lowercase, spaces -> `-`, remove special chars) and ensures uniqueness by adding `-1`, `-2`, ... when needed.
3. Creates the `companies` row, then creates an auth user via `/auth/v1/admin/users` and inserts a `profiles` row with role `professional` and `company` set to the newly created company.
4. Sends a password-reset email via `/auth/v1/recover` redirecting to the `password-reset` function.

Returns: `{ ok: true, company, profile, createUserResult, sendResult }` on success.
