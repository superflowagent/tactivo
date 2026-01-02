// E2E test script for invite flow
// Usage: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY env vars then run `node scripts/e2e/invite-flow.js`

const fetch = require('node-fetch')
const { randomBytes } = require('crypto')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    console.error('Please set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_ANON_KEY in your environment')
    process.exit(1)
}

async function main() {
    const ts = Date.now()
    const email = `e2e-invite-${ts}@example.com`
    const password = `Passw0rd!${randomBytes(4).toString('hex')}`
    console.log('Using test email:', email)

    // Create profile
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ email, name: 'E2E Test' }),
    })
    const profileJson = await profileRes.json()
    if (!profileRes.ok) { console.error('Failed creating profile', profileJson); process.exit(1) }
    const profile = Array.isArray(profileJson) ? profileJson[0] : profileJson
    console.log('Profile created:', profile.id)

    // Generate a token and patch profile
    const token = randomBytes(8).toString('hex')
    const expiry = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            Prefer: 'return=representation'
        },
        body: JSON.stringify({ invite_token: token, invite_expires_at: expiry }),
    })
    const patched = await patchRes.json()
    if (!patchRes.ok) { console.error('Failed patching profile', patched); process.exit(1) }
    console.log('Patched profile with token')

    // Create auth user (admin)
    const createUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`
        },
        body: JSON.stringify({ email, password, email_confirm: true })
    })
    const createUserJson = await createUserRes.json()
    if (!createUserRes.ok) { console.error('Failed creating auth user', createUserJson); process.exit(1) }
    console.log('Auth user created')

    // Sign in to get access token
    const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: ANON_KEY
        },
        body: JSON.stringify({ email, password })
    })
    const signInJson = await signInRes.json()
    if (!signInRes.ok) { console.error('Failed sign-in', signInJson); process.exit(1) }
    const access_token = signInJson?.access_token
    console.log('Signed in, got access token')

    // Call accept_invite RPC
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/accept_invite`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: ANON_KEY,
            Authorization: `Bearer ${access_token}`
        },
        body: JSON.stringify({ p_token: token })
    })
    const rpcJson = await rpcRes.json().catch(() => null)
    console.log('RPC status', rpcRes.status, rpcJson)
    if (!rpcRes.ok) { console.error('accept_invite failed', rpcJson); process.exit(1) }

    console.log('accept_invite success, profile linked')
}

main().catch(err => { console.error(err); process.exit(1) })