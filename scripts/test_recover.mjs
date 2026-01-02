import fs from 'fs'
import path from 'path'
const envPath = path.resolve(process.cwd(), '.env.local')
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const vars = Object.fromEntries(env.split(/\r?\n/).filter(Boolean).map(l => l.split(/=(.+)/)).map(([k, v]) => [k, v]))
const SUPABASE_URL = vars.SUPABASE_URL
const SERVICE_ROLE = vars.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL) throw new Error('.env.local missing SUPABASE_URL')
if (!SERVICE_ROLE) throw new Error('.env.local missing SUPABASE_SERVICE_ROLE_KEY')

const email = process.argv[2] || 'victor97romero@gmail.com'
    ; (async () => {
        try {
            const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/recover`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}` },
                body: JSON.stringify({ email, redirect_to: 'http://localhost:5173/accept-invite' })
            })
            console.log('status', res.status)
            const txt = await res.text()
            console.log('body', txt)
        } catch (e) {
            console.error('error', e)
        }
    })()
