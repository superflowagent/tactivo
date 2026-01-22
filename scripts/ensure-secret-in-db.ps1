# Ensure ADMIN_SECRET from .env.local is present in public.app_settings (PowerShell)
# Usage: pwsh ./scripts/ensure-secret-in-db.ps1

$envFile = Join-Path (Resolve-Path .).Path ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Error ".env.local not found"
    exit 1
}

# Read ADMIN_SECRET
$lines = Get-Content $envFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') }
$adminLine = $lines | Where-Object { $_ -match '^\s*ADMIN_SECRET\s*=\s*(.+)$' }
if (-not $adminLine) {
    Write-Error "ADMIN_SECRET not found in .env.local"
    exit 1
}
$admin = ($adminLine -replace '^\s*ADMIN_SECRET\s*=\s*', '')
# Build SQL using safe concatenation with $$ quoting
$escaped = $admin -replace "'", "''"
$insertSql = "INSERT INTO public.app_settings (key, value) VALUES ('ADMIN_SECRET', '" + $escaped + "') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"
Write-Host "Upserting ADMIN_SECRET into public.app_settings (local DB)"
# Execute via docker exec
& docker exec supabase_db_tactivo-supabase psql -U postgres -c $insertSql
Write-Host "Done."