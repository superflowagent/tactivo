import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const envPath = path.resolve(process.cwd(), '.env.local')
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const vars = Object.fromEntries(env.split(/\r?\n/).filter(Boolean).map(l => l.split(/=(.+)/)).map(([k, v]) => [k, v]))
const SUPABASE_URL = vars.SUPABASE_URL
const SERVICE_ROLE = vars.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_SECRET = vars.ADMIN_SECRET
if (!SUPABASE_URL) throw new Error('.env.local missing SUPABASE_URL')
if (!SERVICE_ROLE) throw new Error('.env.local missing SUPABASE_SERVICE_ROLE_KEY')
if (!ADMIN_SECRET) throw new Error('.env.local missing ADMIN_SECRET')

console.log('Using SUPABASE_URL', SUPABASE_URL)

// Fetch one profile
const fetchProfile = async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email,company,role&limit=1`, {
        headers: { 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' }
    })
    console.log('profiles status', res.status)
    const txt = await res.text()
    console.log('profiles body', txt)
    try { return JSON.parse(txt)[0] } catch { return null }
}

const callSendInvite = async (payload) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
        body: JSON.stringify(payload)
    })
    console.log('send-invite status', res.status)
    const txt = await res.text()
    console.log('send-invite body', txt)
    try { return JSON.parse(txt) } catch { return null }
}

    ; (async () => {
        try {
            const p = await fetchProfile()
            console.log('picked profile', p)
            const payload = p && p.id ? { profile_id: p.id } : { email: p?.email || 'nonexistent@example.com' }
            console.log('calling with payload', payload)
            const r = await callSendInvite(payload)
            console.log('result', r)
        } catch (e) {
            console.error('error', e)
        }
    })()
