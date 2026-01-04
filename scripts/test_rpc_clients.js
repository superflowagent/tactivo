import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
;(async ()=>{
  const env = fs.readFileSync('.env.local','utf8')
  const anon = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()
  const svc = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim()
  const base = 'https://hzztmtkdaofrwcwzotas.supabase.co'
  const svcClient = createClient(base, svc)
  const anonClient = createClient(base, anon)
  const clientId = '6b5373ad-4100-41d3-b807-f02c2a0f2640'

  console.log('svc rpc (expect data):')
  console.log(await svcClient.rpc('get_profiles_by_ids_for_clients', { p_ids: [clientId] }))

  const s = await anonClient.auth.signInWithPassword({ email: 'testclient+002@example.com', password: 'Password123!' })
  const token = s.data?.session?.access_token
  console.log('token exists', !!token)

  const r = await fetch(`${base}/rest/v1/rpc/get_profiles_by_ids_for_clients`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': anon, 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ p_ids: [clientId] }) })
  console.log('client rpc status', r.status, await r.text())

  console.log('svc prof RPC (should return full record):')
  console.log(await svcClient.rpc('get_profiles_by_ids_for_professionals', { p_ids: [clientId] }))

})()
