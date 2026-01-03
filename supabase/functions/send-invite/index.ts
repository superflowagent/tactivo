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
        // Prefer explicit APP_URL env var, otherwise fall back to the request origin (useful for dev)
        const reqOrigin = req.headers.get('origin') || null
        const APP_URL = Deno.env.get('APP_URL') || reqOrigin || Deno.env.get('VITE_SUPABASE_URL') || SUPABASE_URL
        try { console.warn('send-invite resolved APP_URL', { APP_URL, reqOrigin, env_APP_URL_present: !!Deno.env.get('APP_URL') }) } catch { /* ignore */ }

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
        // Capture an ingress preview for debugging (avoid logging full tokens)
        const authHeader = req.headers.get('authorization')
        const tokenPreviewOnIngress = (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) ? (authHeader.substring(7).slice(0, 8) + '...' + `(${authHeader.length})`) : null
        console.warn('send-invite incoming', { method: req.method, provided_present: !!provided, authorization_present: !!authHeader, token_preview: tokenPreviewOnIngress, origin: req.headers.get('origin') })

        // Allow call with ADMIN_SECRET OR an Authorization Bearer token from an authenticated user
        let callerUserId: string | null = null
        if (!provided) {
            // Try bearer token

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
                        const now = Math.floor(Date.now() / 1000)
                        const exp = payload.exp || null
                        jwtMeta = {
                            exp,
                            iat: payload.iat || null,
                            sub: payload.sub || null,
                            expired: exp ? (exp <= now) : null,
                            seconds_to_expiry: exp ? (exp - now) : null,
                        }
                    }
                } catch (e) {
                    jwtMeta = { error: 'decode_failed', decode_error: String(e?.message || e) }
                }
                // Try to extract www-authenticate header if present for hints
                let wwwAuth: string | null = null
                try {
                    wwwAuth = userResp.headers?.get ? userResp.headers.get('www-authenticate') : null
                } catch { wwwAuth = null }
                const authDebug = {
                    status: userResp.status,
                    status_text: userResp.statusText || null,
                    body: authErr,
                    authorization_present: !!authHeader,
                    token_preview: tokenPreview,
                    jwt_meta: jwtMeta,
                    www_authenticate: wwwAuth
                }
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

        // Ensure an auth user exists for the email so the recovery (password reset) email is actually sent.
        // If no user exists, create one using the Admin REST API (Service Role key). This creates a temporary password
        // which the recipient will replace via the recovery link.
        let createUserResult: any = null
        try {
            const tmpPwd = crypto.randomUUID().slice(0, 12)
            const cuResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                },
                body: JSON.stringify({ email: profile.email, password: tmpPwd, email_confirm: false })
            })
            const cuText = await cuResp.text().catch(() => null)
            let cuJson: any = null
            try { if (cuText) cuJson = JSON.parse(cuText) } catch { cuJson = null }
            createUserResult = { status: cuResp.status, body: cuJson || cuText }

            // If created successfully, attempt to update profile.user to reference the new auth user id
            if (cuResp.ok && cuJson && cuJson.id) {
                try {
                    await restProfiles('PATCH', { user: cuJson.id }, `id=eq.${profile.id}`)
                } catch { /* ignore */ }
            }
        } catch (e: any) {
            createUserResult = { error: String(e?.message || e) }
        }

        // Attempt to send the password-reset/invite email via Supabase REST /auth/v1/recover using the Service Role key.
        // Redirect to the app's password reset page so the user lands on our UI (include invite_link as next to continue flow).
        let sendResult: any = null
        let resetUrl: string | null = null
        try {
            // Use the app's password-reset path as the redirect target. We no longer use a client-side bridge.
            // Servers or Edge Functions should perform TokenHash -> session exchange when needed.
            resetUrl = `${APP_URL.replace(/\/$/, '')}/password-reset`
            try { console.warn('send-invite using reset redirect', { resetUrl }) } catch { /* ignore */ }
            const mailResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/recover`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                },
                body: JSON.stringify({ email: profile.email, redirect_to: resetUrl })
            })
            // Capture both raw text and JSON (if any) for diagnostics
            const mailText = await mailResp.text().catch(() => null)
            let mailJson: any = null
            try { if (mailText) mailJson = JSON.parse(mailText) } catch { mailJson = null }

            if (!mailResp.ok) {
                sendResult = { ok: false, provider: 'supabase-rest', status: mailResp.status, error: mailJson || mailText }
            } else {
                sendResult = { ok: true, provider: 'supabase-rest', status: mailResp.status, info: mailJson || null, raw: mailText }
            }
        } catch (e: any) {
            sendResult = { ok: false, error: String(e?.message || e) }
        }

        // Log both results for diagnostics so dashboard logs show whether user creation and send were accepted
        try { console.warn('send-invite sendResult', { email: profile.email, createUserResult, sendResult, resetUrl }) } catch { /* ignore */ }

        return jsonResponse({ ok: true, invite_link, resetUrl, createUserResult, sendResult }, 200)
    } catch (err: any) {
        return jsonResponse({ error: String(err?.message || err) }, 500)
    }
})