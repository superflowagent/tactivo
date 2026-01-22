$funcs = supabase functions list --project-ref hzztmtkdaofrwcwzotas --output json | ConvertFrom-Json
foreach ($f in $funcs) {
  Write-Host "Downloading: $($f.name)"
  supabase functions download $f.name --project-ref hzztmtkdaofrwcwzotas
}