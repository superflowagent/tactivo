import { serve } from 'https://deno.land/std@0.178.0/http/server.ts'

serve(async (req) => {
    const origin = req.headers.get('origin') || '*'
    const corsHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Secret, X-Admin-Token',
        'Access-Control-Max-Age': '3600',
        'Vary': 'Origin'
    }
    if (origin !== '*') corsHeaders['Access-Control-Allow-Credentials'] = 'true'

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }






    const jsonResponse = (body: any, status = 200) => {
        const h: Record<string, string> = { 'Content-Type': 'application/json', ...corsHeaders }
        return new Response(JSON.stringify(body), { status, headers: h })
    }

    try {
        const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const APP_URL = Deno.env.get('APP_URL') || Deno.env.get('VITE_SUPABASE_URL') || SUPABASE_URL

        if (!ADMIN_SECRET) return jsonResponse({ error: 'ADMIN_SECRET not configured' }, 500)
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({ error: 'Supabase not configured' }, 500)

        // Helper to call Supabase REST for profiles using Service Role key
        const restProfiles = async (method: string, body?: any, query?: string) => {
            const url = `${SUPABASE_URL}/rest/v1/profiles${query ? `?${query}` : ''}`
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Prefer': 'return=representation'
                },
                body: body ? JSON.stringify(body) : undefined
            })
            const text = await res.text()
            let data: any = null
            try { data = JSON.parse(text) } catch { data = text }
            return { ok: res.ok, status: res.status, data }
        }

        const provided = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token')
        // Allow call with ADMIN_SECRET OR an Authorization Bearer token from an authenticated user
        let callerUserId: string | null = null
        if (!provided) {
            // Try bearer token
            const authHeader = req.headers.get('authorization')
            if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
                const dbg = { authorization_present: false, provided_present: !!provided }
                console.warn('Missing authorization header', dbg)
                return jsonResponse({ error: 'Unauthorized', auth_debug: dbg }, 401)
            }
            const bearer = authHeader.substring(7)
            // Validate token by calling auth/v1/user (include apikey for robust validation)
            const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${bearer}` } })
            if (!userResp.ok) {
                // Try to parse auth error body for helpful debugging
                let authErr: any = null
                try { authErr = await userResp.json() } catch { try { authErr = await userResp.text() } catch { authErr = null } }
                // Normalize auth error to include a 'message' property so clients can show it consistently
                let authErrMsg: string | null = null
                if (authErr) {
                    if (typeof authErr === 'string') authErrMsg = authErr
                    else if (typeof authErr === 'object') authErrMsg = authErr.message || authErr.error || JSON.stringify(authErr)
                }
                // Try to decode some metadata from the JWT without logging the full token
                const tokenPreview = typeof bearer === 'string' ? (bearer.slice(0, 8) + '...' + (bearer.length ? `(${bearer.length})` : '')) : null
                let jwtMeta: any = null
                try {
                    const parts = bearer.split('.')
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
                        jwtMeta = { exp: payload.exp, iat: payload.iat, sub: payload.sub }
                    }
                } catch {
                    jwtMeta = { error: 'decode_failed' }
                }
                const authDebug = { status: userResp.status, body: authErr, authorization_present: !!authHeader, token_preview: tokenPreview, jwt_meta: jwtMeta }
                console.warn('Auth validation failed', authDebug)
                return jsonResponse({ error: 'Invalid token', auth_error: { message: authErrMsg }, auth_debug: authDebug }, 401)
            }
            const userJson = await userResp.json()
            callerUserId = userJson.id
            if (!callerUserId) return jsonResponse({ error: 'Invalid token' }, 401)
        } else {
            // Admin secret provided, proceed as admin
            if (provided !== ADMIN_SECRET) return jsonResponse({ error: 'Unauthorized' }, 401)
        }

        if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

        const body = await req.json().catch(() => ({}))
        const { profile_id, email, expires_in_days } = body
        if (!profile_id && !email) return new Response(JSON.stringify({ error: 'profile_id or email is required' }), { status: 400 })

        // Lookup profile by id or email using REST
        let profile: any = null
        if (profile_id) {
            const { ok, data, status } = await restProfiles('GET', undefined, `id=eq.${profile_id}`)
            if (!ok || !data || (Array.isArray(data) && data.length === 0)) return new Response(JSON.stringify({ error: 'profile_not_found' }), { status: 404 })
            profile = Array.isArray(data) ? data[0] : data
        } else if (email) {
            const { ok, data } = await restProfiles('GET', undefined, `email=eq.${encodeURIComponent(email)}`)
            if (!ok || !data || (Array.isArray(data) && data.length === 0)) return new Response(JSON.stringify({ error: 'profile_not_found' }), { status: 404 })
            profile = Array.isArray(data) ? data[0] : data
        }

        if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)

        // Generate token if missing
        const token = profile.invite_token || crypto.randomUUID()
        const days = Number(expires_in_days || 7)
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().replace('Z', '') // keep timestamp without tz if desired

        // Update profile with token & expiry (service role)
        const upd = await restProfiles('PATCH', { invite_token: token, invite_expires_at: expiresAt }, `id=eq.${profile.id}`)
        if (!upd.ok) return jsonResponse({ error: 'failed_to_update_profile', details: upd }, 500)

        const invite_link = `${APP_URL.replace(/\/$/, '')}/accept-invite?invite_token=${token}`

        // Authorization check for bearer callers: ensure caller belongs to same company and has role to invite
        if (callerUserId) {
            try {
                const caller = await restProfiles('GET', undefined, `user=eq.${callerUserId}`)
                if (!caller.ok || !caller.data || (Array.isArray(caller.data) && caller.data.length === 0)) return jsonResponse({ error: 'caller_profile_missing' }, 403)
                const callerProfile = Array.isArray(caller.data) ? caller.data[0] : caller.data
                // Only allow if caller is admin or professional and same company
                if (!(['admin', 'professional'].includes(callerProfile.role || '')) || String(callerProfile.company) !== String(profile.company)) {
                    return jsonResponse({ error: 'forbidden' }, 403)
                }
            } catch (e: any) {
                return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 })
            }
        }

        // Attempt to send the password-reset/invite email via Supabase REST /auth/v1/recover using the Service Role key.
        // This avoids importing @supabase/supabase-js in the function bundle.
        let sendResult: any = null
        try {
            const mailResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/recover`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                },
                body: JSON.stringify({ email: profile.email, redirect_to: invite_link })
            })
            const mailJson = await mailResp.json().catch(() => null)
            if (!mailResp.ok) {
                sendResult = { ok: false, provider: 'supabase-rest', status: mailResp.status, error: mailJson || await mailResp.text() }
            } else {
                sendResult = { ok: true, provider: 'supabase-rest', info: mailJson }
            }
        } catch (e: any) {
            sendResult = { ok: false, error: String(e?.message || e) }
        }

        return jsonResponse({ ok: true, invite_link, sendResult }, 200)
    } catch (err: any) {
        return jsonResponse({ error: String(err?.message || err) }, 500)
    }
})