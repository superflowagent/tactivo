# Apply Supabase secrets from .env.local (Windows / PowerShell)
# Reads .env.local and sets an allowlist of secrets to the Supabase CLI with `supabase secrets set`.
# Usage: pwsh ./scripts/apply-secrets.ps1

$envFile = Join-Path (Resolve-Path .).Path ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Error ".env.local not found"
    exit 1
}

$allowed = @('ADMIN_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'APP_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL')

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    if ($line -match '^(?<k>[^=]+)=(?<v>.*)$') {
        $k = $Matches['k'].Trim(); $v = $Matches['v'].Trim()
        if ($allowed -contains $k) {
            Write-Host "Setting secret: $k"
            & supabase secrets set "$k=$v" | Out-Null
        }
    }
}
Write-Host "Secrets applied (if present)."