if (Test-Path '.env.local') {
  $m = Get-Content .env.local | Select-String '^SUPABASE_SERVICE_ROLE_KEY=' | Select-Object -First 1
  if ($m) {
    $v = ($m.Line -split '=',2)[1].Trim('"')
    $env:SUPABASE_SERVICE_ROLE_KEY = $v
    Write-Output 'Found key and exported (hidden).'
  } else { Write-Output 'No SUPABASE_SERVICE_ROLE_KEY found in .env.local' }
} else { Write-Output '.env.local not found' }

supabase db pull --debug
