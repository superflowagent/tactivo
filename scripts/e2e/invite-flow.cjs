// E2E test script for invite flow (CommonJS)
// Usage: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY env vars then run `node scripts/e2e/invite-flow.cjs`

// Load env vars from .env.local if present
try { require('dotenv').config({ path: '.env.local' }) } catch { /* dotenv may not be installed in some envs */ }

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

    // Create profile and return representation
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            Prefer: 'return=representation'
        },
        body: JSON.stringify({ email, name: 'E2E Test' }),
    })
    const profileText = await profileRes.text().catch(() => '')
    let profileJson = null
    try { profileJson = profileText ? JSON.parse(profileText) : null } catch { profileJson = profileText }
    if (!profileRes.ok) { console.error('Failed creating profile', { status: profileRes.status, body: profileJson }); process.exit(1) }
    const profile = Array.isArray(profileJson) ? profileJson[0] : profileJson
    console.log('Profile created:', profile.id)

    // Generate a token and patch profile
    const token = (require('crypto').randomUUID ? require('crypto').randomUUID() : randomBytes(8).toString('hex'))
    const expiry = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    const patchUrl = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`
    const patchBody = JSON.stringify({ invite_token: token, invite_expires_at: expiry })
    console.log('Patching URL:', patchUrl)
    console.log('Patching body:', patchBody)
    const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            Prefer: 'return=representation'
        },
        body: patchBody,
    })
    const patchedText = await patchRes.text().catch(() => '')
    const patched = (() => { try { return patchedText ? JSON.parse(patchedText) : null } catch { return patchedText } })()
    if (!patchRes.ok) { console.error('Failed patching profile', { status: patchRes.status, body: patched }); process.exit(1) }
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
    console.log('Auth user created', createUserJson)

    // Optionally call debug sim function with service role to see if update path fails as same caller
    if (process.env.E2E_DEBUG === '1') {
        try {
            const dbgSimRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/dbg_accept_invite_sim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
                body: JSON.stringify({ p_token: token, p_caller: createUserJson?.id })
            })
            const dbgText = await dbgSimRes.text().catch(() => '')
            let dbgJson = null
            try { dbgJson = dbgText ? JSON.parse(dbgText) : null } catch { dbgJson = dbgText }
            console.log('Dbg sim result:', dbgSimRes.status, dbgJson)
        } catch (err) {
            console.warn('Dbg sim failed:', err)
        }
    }

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

    // Debug: fetch trigger definitions for profiles (service role)
    try {
        const debugRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/debug_list_profiles_triggers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
        })
        const debugText = await debugRes.text().catch(() => '')
        let debugJson = null
        try { debugJson = debugText ? JSON.parse(debugText) : null } catch { debugJson = debugText }
        console.log('Debug triggers (information_schema):', debugRes.status, debugJson)
    } catch (err) {
        console.warn('Failed to fetch info_schema debug triggers:', err)
    }

    // Debug: fetch pg_trigger/function info (service role)
    try {
        const pgres = await fetch(`${SUPABASE_URL}/rest/v1/rpc/debug_list_pg_triggers_profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
        })
        const pgtext = await pgres.text().catch(() => '')
        let pgjson = null
        try { pgjson = pgtext ? JSON.parse(pgtext) : null } catch { pgjson = pgtext }
        console.log('PG triggers:', pgres.status, pgjson)
    } catch (err) {
        console.warn('Failed to fetch pg_trigger debug:', err)
    }

    // Call accept_invite_verbose RPC to get step-by-step diagnostics
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/accept_invite_verbose`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: ANON_KEY,
            Authorization: `Bearer ${access_token}`
        },
        body: JSON.stringify({ p_token: token })
    })
    const rpcText = await rpcRes.text().catch(() => '')
    let rpcJson = null
    try { rpcJson = rpcText ? JSON.parse(rpcText) : null } catch { rpcJson = rpcText }
    console.log('RPC status', rpcRes.status, rpcJson)
    if (!rpcRes.ok) { console.error('accept_invite failed', rpcJson); process.exit(1) }

    // Verify profile state after RPC
    try {
        const afterRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
        })
        const afterText = await afterRes.text().catch(() => '')
        let afterJson = null
        try { afterJson = afterText ? JSON.parse(afterText) : null } catch { afterJson = afterText }
        console.log('Profile after RPC:', afterRes.status, afterJson)
    } catch (err) { console.warn('Failed to fetch profile after RPC', err) }

    console.log('accept_invite success, profile linked')
}

main().catch(err => { console.error(err); process.exit(1) })