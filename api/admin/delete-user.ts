import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Serverless endpoint to delete a profile row and its associated auth user (if any).
// Accepts either an ADMIN_SECRET header or a Bearer token from an authenticated admin in the same company.

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const adminSecret = process.env.ADMIN_SECRET
    if (!adminSecret) return res.status(500).json({ error: 'Server not configured (ADMIN_SECRET missing)' })

    const provided = req.headers['x-admin-secret'] || req.headers['x-admin-token']

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'Server not configured (Supabase keys missing)' })

    const body = req.body || {}
    const { profile_id } = body
    if (!profile_id) return res.status(400).json({ error: 'profile_id required' })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

    try {
        // Lookup the target profile (service role)
        const { data: rows } = await supabase.from('profiles').select('*').eq('id', profile_id).maybeSingle()
        if (!rows) return res.status(404).json({ error: 'profile_not_found' })
        const targetProfile: any = rows

        // If admin secret provided, proceed as admin
        let callerUserId: string | null = null
        if (!provided) {
            // Otherwise require Authorization: Bearer <token>
            const authHeader = req.headers['authorization'] as string | undefined
            if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return res.status(401).json({ error: 'Unauthorized' })
            const bearer = authHeader.substring(7)
            // Validate token
            const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${bearer}` } })
            if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' })
            const userJson = await userResp.json()
            callerUserId = userJson.id
            if (!callerUserId) return res.status(401).json({ error: 'Invalid token' })

            // Ensure caller has a profile and is admin and same company
            const { data: callerProfile } = await supabase.from('profiles').select('id, user, role, company').eq('user', callerUserId).maybeSingle()
            if (!callerProfile) return res.status(403).json({ error: 'caller_profile_missing' })
            if (callerProfile.role !== 'admin' && callerProfile.role !== 'owner') return res.status(403).json({ error: 'forbidden' })
            if (String(callerProfile.company) !== String(targetProfile.company)) return res.status(403).json({ error: 'forbidden' })
        } else {
            if (provided !== adminSecret) return res.status(401).json({ error: 'Unauthorized' })
        }

        // Delete profile's files in storage if present
        try {
            if (targetProfile.photo_path) {
                // prefer root filename then id-prefixed
                const keysToTry = [targetProfile.photo_path, `${targetProfile.id}/${targetProfile.photo_path}`]
                for (const k of keysToTry) {
                    try {
                        await supabase.storage.from('profile_photos').remove([k])
                    } catch (e) { /* ignore */ }
                }
            }
        } catch (e) {
            // ignore storage errors
            console.warn('Storage delete failed', e)
        }

        // Delete profile row (by id)
        const { error: delErr } = await supabase.from('profiles').delete().eq('id', profile_id)
        if (delErr) return res.status(500).json({ error: delErr.message })

        // If profile had a linked auth user, delete it via admin REST
        if (targetProfile.user) {
            try {
                const userId = targetProfile.user
                const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
                    method: 'DELETE',
                    headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
                })
                if (!resp.ok) {
                    const txt = await resp.text().catch(() => '')
                    // Log but don't fail the whole operation
                    console.warn('Failed deleting auth user', resp.status, txt)
                }
            } catch (e) {
                console.warn('Auth user delete failed', e)
            }
        }


        return res.status(200).json({ ok: true })
    } catch (err: any) {
        console.error('delete-user error', err)
        return res.status(500).json({ error: err?.message || String(err) })
    }
}
