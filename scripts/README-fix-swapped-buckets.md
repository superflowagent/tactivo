Fix swapped bucket objects script

Purpose:
This script helps detect objects that were uploaded into the wrong buckets (company logos stored in `exercise_videos` and exercise videos stored in `company_logos`) and move them to the correct buckets while updating DB references.

Prerequisites:
- Node 18+ (or node with global fetch)
- Environment variables set: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (service role key)

Usage:
- Dry run (no writes):
  SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role_key> node scripts/fix_swapped_buckets.js --dry-run

- Apply changes (copy & DB update):
  SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role_key> node scripts/fix_swapped_buckets.js --apply

Behavior:
- Companies: if `companies.logo_path` is not found in `company_logos` but exists in `exercise_videos`, it copies the object to `company_logos/<companyId>/<basename>` and updates `companies.logo_path`.
- Exercises: if `exercises.file` is not found in `exercise_videos` but exists in `company_logos`, it copies the object to `exercise_videos/<exerciseId>/<basename>` and updates `exercises.file`.
- If a target path already exists, the script appends a timestamp to avoid overwriting.

Notes & Safety:
- The script uses the Service Role key and will perform writes only with `--apply`.
- Always run a dry-run first and validate the planned changes before applying.
- The script does not delete the original object; it copies and updates DB references. After verifying correctness you may choose to delete originals.
