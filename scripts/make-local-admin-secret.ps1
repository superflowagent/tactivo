# Create .local_admin_secret from .env.local (PowerShell)
$envFile = Join-Path (Resolve-Path .).Path ".env.local"
if (-not (Test-Path $envFile)) { Write-Error ".env.local not found"; exit 1 }
$admin = Get-Content $envFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') } | Where-Object { $_ -match '^\s*ADMIN_SECRET\s*=\s*(.+)$' }
if (-not $admin) { Write-Error "ADMIN_SECRET not found in .env.local"; exit 1 }
$val = ($admin -replace '^\s*ADMIN_SECRET\s*=\s*', '')
Set-Content -NoNewline -Path .\.local_admin_secret -Value $val
Write-Host "Created .local_admin_secret"