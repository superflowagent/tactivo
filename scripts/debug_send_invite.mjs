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
    // Fetch a set of profiles and pick one that has an email (so the recover email can be sent)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email,company,role&limit=100`, {
        headers: { 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' }
    })
    console.log('profiles status', res.status)
    const txt = await res.text()
    console.log('profiles body', txt)
    try { const arr = JSON.parse(txt); return (arr || []).find(p => p && p.email) || arr?.[0] || null } catch { return null }
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
            // Force test email for E2E invocation
            const payload = { email: 'dev+e2e@tactivo.local' }
            console.log('calling with payload', payload)
            let r = await callSendInvite(payload)
            console.log('result', r)

            // If the function reports profile_not_found when using an email, create a temporary profile
            if (r && r.error === 'profile_not_found' && payload.email) {
                try {
                    console.log('Creating temporary profile for email', payload.email)
                    // Use the company from the picked profile if available, otherwise omit
                    const companyId = p?.company || undefined
                    const createRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}`, 'Prefer': 'return=representation' },
                        body: JSON.stringify({ email: payload.email, company: companyId || null, role: 'professional', name: 'E2E Test' })
                    })
                    const createText = await createRes.text().catch(() => null)
                    const createJson = createText ? JSON.parse(createText) : null
                    console.log('create profile status', createRes.status, 'body', createJson)
                    const newProfile = Array.isArray(createJson) ? createJson[0] : createJson
                    if (newProfile && (newProfile.id || newProfile.user)) {
                        const newId = newProfile.id || newProfile.user
                        console.log('Retrying send-invite with profile_id', newId)
                        r = await callSendInvite({ profile_id: newId })
                        console.log('retry result', r)
                    } else {
                        console.warn('Failed to create profile automatically')
                    }
                } catch (e) {
                    console.error('Error creating test profile', e)
                }
            }

        } catch (e) {
            console.error('error', e)
        }
    })()
