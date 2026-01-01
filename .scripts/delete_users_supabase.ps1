# Script to delete all Supabase auth users except a fixed set
# WARNING: irreversible. Run only if you confirmed.

$envFile = 'd:\Desktop\tactivo\.env.local'
$content = Get-Content $envFile -ErrorAction Stop

$SUPABASE_URL = $null
$SERVICE_ROLE_KEY = $null
foreach ($line in $content) {
  if ($line -match '^\s*SUPABASE_URL\s*=') {
    $val = ($line -split '=',2)[1].Trim()
    if ($val.Length -ge 2 -and ($val.StartsWith("'") -and $val.EndsWith("'"))) { $val = $val.Substring(1,$val.Length-2) }
    elseif ($val.Length -ge 2 -and ($val.StartsWith('"') -and $val.EndsWith('"'))) { $val = $val.Substring(1,$val.Length-2) }
    $SUPABASE_URL = $val
  } elseif ($line -match '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=') {
    $val = ($line -split '=',2)[1].Trim()
    if ($val.Length -ge 2 -and ($val.StartsWith("'") -and $val.EndsWith("'"))) { $val = $val.Substring(1,$val.Length-2) }
    elseif ($val.Length -ge 2 -and ($val.StartsWith('"') -and $val.EndsWith('"'))) { $val = $val.Substring(1,$val.Length-2) }
    $SERVICE_ROLE_KEY = $val
  }
}

if (-not $SUPABASE_URL -or -not $SERVICE_ROLE_KEY) {
  Write-Error "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in $envFile"
  exit 1
}

$except = @('f2855f14-0bca-4b22-ae72-dbeb968a9372','a367d3a9-f219-4cc5-a5c7-cd9639af07fd')
$page = 1
$deletedCount = 0

Write-Output "Starting deletion loop..."
while ($true) {
  $url = "$SUPABASE_URL/auth/v1/admin/users?per_page=100&page=$page"
  try {
    $resp = Invoke-RestMethod -Method Get -Uri $url -Headers @{ Authorization = "Bearer $SERVICE_ROLE_KEY"; apikey = $SERVICE_ROLE_KEY } -ErrorAction Stop
  } catch {
    Write-Error ("Failed to fetch users on page {0}: {1}" -f $page, $_)
    exit 1
  }

  if ($null -ne $resp.users) { $users = @($resp.users) }
  elseif ($resp -is [System.Collections.IEnumerable]) { $users = @($resp) }
  elseif ($null -ne $resp.data) { $users = @($resp.data) }
  else { $users = @() }

  if ($users.Count -eq 0) { break }

  foreach ($u in $users) {
    $id = $u.id
    if ($except -contains $id) { continue }
    try {
      Invoke-RestMethod -Method Delete -Uri "$SUPABASE_URL/auth/v1/admin/users/$id" -Headers @{ Authorization = "Bearer $SERVICE_ROLE_KEY"; apikey = $SERVICE_ROLE_KEY } -ErrorAction Stop
      $deletedCount++
      Write-Output "Deleted $id"
    } catch {
      Write-Error ("Failed to delete {0}: {1}" -f $id, $_)
    }
  }
  $page++
}

Write-Output "Done. Deleted $deletedCount users."

# Final check: fetch first page to see remaining users count
try {
  $final = Invoke-RestMethod -Method Get -Uri "$SUPABASE_URL/auth/v1/admin/users?per_page=1000" -Headers @{ Authorization = "Bearer $SERVICE_ROLE_KEY"; apikey = $SERVICE_ROLE_KEY } -ErrorAction Stop
  if ($null -ne $final.users) { $remaining = @($final.users).Count }
  elseif ($final -is [System.Collections.IEnumerable]) { $remaining = @($final).Count }
  elseif ($null -ne $final.data) { $remaining = @($final.data).Count }
  else { $remaining = 0 }
  Write-Output "Remaining users returned by API (first page): $remaining"
  Write-Output "Preserved IDs: $($except -join ', ')"
} catch {
  Write-Error ("Failed to fetch final users: {0}" -f $_)
}
