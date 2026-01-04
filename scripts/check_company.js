import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
;(async ()=>{
  const env = fs.readFileSync('.env.local','utf8')
  const anon = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()
  const base = 'https://hzztmtkdaofrwcwzotas.supabase.co'
  const anonClient = createClient(base, anon)
  const s = await anonClient.auth.signInWithPassword({ email: 'testclient+002@example.com', password: 'Password123!' })
  const token = s.data?.session?.access_token
  console.log('token present', !!token)
  const resp = await fetch(`${base}/rest/v1/companies?select=*&id=eq.c2ca341f-9c83-4c33-98f5-01a98c910106`, { headers: { 'apikey': anon, 'Authorization': 'Bearer ' + token } })
  console.log('companies status', resp.status)
  console.log(await resp.text())
})()
