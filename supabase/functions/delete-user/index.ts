import { serve } from 'https://deno.land/std@0.178.0/http/server.ts'

serve(async (req) => {
    // CORS and helpers
    const origin = req.headers.get('origin') || '*'
    const corsHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Secret, X-Admin-Token',
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

        if (!ADMIN_SECRET) return jsonResponse({ error: 'ADMIN_SECRET not configured' }, 500)
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({ error: 'Supabase not configured' }, 500)

        const provided = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token')

        // Parse body
        const body = await req.json().catch(() => ({}))
        const { profile_id } = body
        if (!profile_id) return jsonResponse({ error: 'profile_id required' }, 400)

        // Helper to use Service Role REST for profiles
        const rest = async (method: string, path: string, body?: any) => {
            const url = `${SUPABASE_URL}${path}`
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_SERVICE_ROLE_KEY,
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                },
                body: body ? JSON.stringify(body) : undefined
            })
            const text = await res.text().catch(() => '')
            let data: any = null
            try { data = text ? JSON.parse(text) : null } catch { data = text }
            return { ok: res.ok, status: res.status, data }
        }

        // Lookup profile using service role
        const { ok: getOk, data: profileData } = await rest('GET', `/rest/v1/profiles?id=eq.${profile_id}`)
        if (!getOk || !profileData || (Array.isArray(profileData) && profileData.length === 0)) return jsonResponse({ error: 'profile_not_found' }, 404)
        const profile = Array.isArray(profileData) ? profileData[0] : profileData

        // Authorization: admin-secret or bearer token validated + same-company admin
        let callerUserId: string | null = null
        if (!provided) {
            const authHeader = req.headers.get('authorization')
            if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
                const dbg = { authorization_present: false, provided_present: !!provided }
                console.warn('Missing authorization header', dbg)
                return jsonResponse({ error: 'Unauthorized', auth_debug: dbg }, 401)
            }
            const bearer = authHeader.substring(7)
            // Validate token (include apikey header for robust validation)
            const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${bearer}` } })
            if (!userResp.ok) {
                let authErr: any = null
                try { authErr = await userResp.json() } catch { authErr = await userResp.text().catch(() => null) }
                let authErrMsg: string | null = null
                if (authErr) {
                    if (typeof authErr === 'string') authErrMsg = authErr
                    else if (typeof authErr === 'object') authErrMsg = authErr.message || authErr.error || JSON.stringify(authErr)
                }
                const authDebug = { status: userResp.status, body: authErr, authorization_present: !!authHeader }
                console.warn('Auth validation failed', authDebug)
                return jsonResponse({ error: 'Invalid token', auth_error: { message: authErrMsg }, auth_debug: authDebug }, 401)
            }
            const userJson = await userResp.json()
            callerUserId = userJson.id
            if (!callerUserId) return jsonResponse({ error: 'Invalid token' }, 401)

            // Check caller profile
            const caller = await rest('GET', `/rest/v1/profiles?user=eq.${callerUserId}`)
            if (!caller.ok || !caller.data || (Array.isArray(caller.data) && caller.data.length === 0)) {
                const dbg = { callerUserId, caller_ok: !!caller.ok, caller_data_length: Array.isArray(caller.data) ? caller.data.length : (caller.data ? 1 : 0) }
                console.warn('Caller profile missing', dbg)
                return jsonResponse({ error: 'caller_profile_missing', auth_debug: dbg }, 403)
            }
            const callerProfile = Array.isArray(caller.data) ? caller.data[0] : caller.data
            if (!(['admin', 'owner'].includes(callerProfile.role || '')) || String(callerProfile.company) !== String(profile.company)) {
                const dbg = { callerRole: callerProfile.role, callerCompany: callerProfile.company, targetCompany: profile.company }
                console.warn('Forbidden: caller lacks permissions', dbg)
                return jsonResponse({ error: 'forbidden', auth_debug: dbg }, 403)
            }
        } else {
            if (provided !== ADMIN_SECRET) {
                const dbg = { provided_present: true, provided_length: provided ? String(provided).length : 0 }
                console.warn('Admin secret provided but invalid', dbg)
                return jsonResponse({ error: 'Unauthorized', auth_debug: dbg }, 401)
            }
        }

        // Delete storage objects if present (best-effort)
        try {
            if (profile.photo_path) {
                const candidates = [profile.photo_path, `${profile.id}/${profile.photo_path}`]
                for (const key of candidates) {
                    try { await rest('DELETE', `/storage/v1/object/profile_photos/${encodeURIComponent(key)}`) } catch { /* ignore */ }
                }
            }
        } catch (e) {
            // ignore storage errors
        }

        // Delete profile row
        const del = await rest('DELETE', `/rest/v1/profiles?id=eq.${profile.id}`)
        if (!del.ok) return jsonResponse({ error: 'failed_deleting_profile', details: del }, 500)

        // If profile had a linked auth user, delete via admin REST
        if (profile.user) {
            try {
                const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${profile.user}`, {
                    method: 'DELETE',
                    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
                })
                if (!resp.ok) {
                    const txt = await resp.text().catch(() => '')
                    // Log but continue
                    console.warn('Failed deleting auth user', resp.status, txt)
                }
            } catch (e) {
                console.warn('Auth user delete failed', e)
            }
        }

        return jsonResponse({ ok: true }, 200)
    } catch (err: any) {
        return jsonResponse({ error: String(err?.message || err) }, 500)
    }
})