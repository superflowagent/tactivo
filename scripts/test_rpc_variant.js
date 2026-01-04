import fs from 'fs'
;(async ()=>{
  const { createClient } = await import('@supabase/supabase-js')
  const env = fs.readFileSync('.env.local','utf8')
  const svc = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim()
  const base = 'https://hzztmtkdaofrwcwzotas.supabase.co'
  const svcClient = createClient(base, svc)
  const clientId = '6b5373ad-4100-41d3-b807-f02c2a0f2640'

  console.log('rpc with p_ids as array (service role):', await svcClient.rpc('get_profiles_by_ids_for_clients', { p_ids: [clientId] }))

  // now sign in as client and call rpc as them
  const anon = fs.readFileSync('.env.local','utf8').match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()
  const anonClient = createClient(base, anon)
  const sign = await anonClient.auth.signInWithPassword({ email: 'testclient+002@example.com', password: 'Password123!' })
  const token = sign.data?.session?.access_token
  console.log('signed in, token present', !!token)
  const res = await fetch(`${base}/rest/v1/rpc/get_profiles_by_ids_for_clients`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': anon, 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ p_ids: [clientId] }) })
  console.log('client RPC status', res.status, await res.text())

  const res2 = await fetch(`${base}/rest/v1/rpc/get_profiles_by_ids_for_clients`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': anon, 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ p_ids: `{${clientId}}` }) })
  console.log('client RPC variant status', res2.status, await res2.text())


})()
