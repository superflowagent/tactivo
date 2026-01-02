import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
    // Not throwing to allow builds of non-auth code, but warn in console
    console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        detectSessionInUrl: true,
    },
})

// DEV-only instrumentation: catch any accidental REST queries building malformed `or=` on profiles
if (import.meta.env.DEV) {
    try {
        const _origFetch = (window as any).fetch
            (window as any).fetch = async function (...args: any[]): Promise<any> {
                try {
                    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url
                    if (url && url.includes('/rest/v1/profiles') && url.includes('or=')) {
                        // Log stack and url to help find caller
                        console.warn('Detected profiles OR request:', url)
                        console.warn(new Error('Trace: profiles OR request').stack)
                    }
                } catch (err) {
                    // ignore
                }
                return _origFetch.apply(this, args)
            }
    } catch (err) {
        // ignore in environments where fetch cannot be overridden
    }
}

export const getPublicUrl = (bucket: string, path: string) => {
    try {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        return data?.publicUrl || null
    } catch {
        return null
    }
}

/**
 * Conveniencia para obtener la URL pública de un archivo asociado a un "record".
 * Por convención usa un bucket con el mismo nombre que la "collection" y asume
 * rutas con formato `${id}/${filename}`. Revisa si tus buckets difieren.
 */
export const getFilePublicUrl = (collection: string, id: string | undefined | null, filename: string | undefined | null, bucket?: string) => {
    if (!filename) return null
    try {
        const b = bucket || collection
        // Prefer root filename first, then <id>/<filename> for legacy entries
        const candidates = id ? [`${filename}`, `${id}/${filename}`] : [`${filename}`]
        for (const path of candidates) {
            try {
                const { data } = supabase.storage.from(b).getPublicUrl(path)
                if (data?.publicUrl) return data.publicUrl
            } catch {
                // ignore and try next candidate
            }
        }
        return null
    } catch {
        return null
    }
}

export const getAuthToken = async () => {
    try {
        const { data } = await supabase.auth.getSession()
        return data.session?.access_token || null
    } catch {
        return null
    }
}

// Ensure the current session's access token is valid. If expired, attempt to refresh
export async function ensureValidSession(): Promise<boolean> {
    try {
        const { data } = await supabase.auth.getSession()
        const session = data.session
        if (!session) return false
        const access = session.access_token
        const refresh = session.refresh_token
        if (!access) return false

        // decode token payload to check exp
        try {
            const payload = access.split('.')[1]
            const decoded = JSON.parse(decodeURIComponent(escape(window.atob(payload))))
            const exp = decoded.exp || decoded.expiration || 0
            const now = Math.floor(Date.now() / 1000)
            // If token is valid for at least another 30 seconds, we're fine
            if (exp && exp > now + 30) return true
        } catch {
            // cannot decode, continue to refresh attempt
        }

        // Attempt refresh using GoTrue token endpoint
        if (!refresh) return false
        const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token`
        const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'apikey': supabaseAnonKey
            },
            body
        })
        if (!res.ok) return false
        const json = await res.json().catch(() => null)
        if (!json || !json.access_token) return false

        // Try to update client session if client supports it
        try {
            // supabase.auth.setSession exists in newer clients; use it if available
            if (typeof (supabase.auth as any).setSession === 'function') {
                await (supabase.auth as any).setSession({ access_token: json.access_token, refresh_token: json.refresh_token })
            } else if (typeof (supabase.auth as any).refreshSession === 'function') {
                // fallback API if present
                await (supabase.auth as any).refreshSession()
            } else {
                // Last resort: reload page to ensure session is refreshed via cookie flow
                console.warn('No client session setter available; reloading to refresh session')
                window.location.reload()
            }
            return true
        } catch (e) {
            console.warn('Failed to set new session locally', e)
            try { window.location.reload() } catch { /* ignore */ }
            return false
        }
    } catch (e) {
        console.warn('ensureValidSession error', e)
        return false
    }
}

/**
 * Fetch profile by user id with fallback for legacy schemas.
 * Tries columns in order: `user` (current schema), `id`, `user_id` (legacy).
 */
export async function fetchProfileByUserId(userId: string) {
    if (!userId) return null

    // Prefer RPC to avoid PostgREST column-name parsing issues for reserved column names like "user"
    try {
        const { data, error } = await supabase.rpc('get_profile_by_user', { p_user: userId })
        if (!error && data) return data
    } catch {
        // ignore and fallthrough to direct selects
    }

    // try current 'user' column
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('user', userId).maybeSingle()
        if (!error && data) return data
    } catch {
        // ignore and fallthrough
    }

    // try primary key 'id'
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
        if (!error && data) return data
    } catch {
        // ignore and fallthrough
    }

    // legacy 'user_id' removed — prefer 'user' or 'id' only (column not present)
    // skipped user_id for performance and to avoid 400 errors.

    return null
}

/**
 * Update the profile identified by a user id; tries columns in order and returns the result.
 */
export async function updateProfileByUserId(userId: string, payload: any) {
    if (!userId) return { error: 'missing userId' }
    // try 'id' first (safer when 'user' column causes PostgREST issues)
    try {
        const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select().maybeSingle()
        if (!error && data) return { data, error: null }
    } catch {
        // ignore
    }
    // try 'user'
    try {
        const { data, error } = await supabase.from('profiles').update(payload).eq('user', userId).select().maybeSingle()
        if (!error && data) return { data, error: null }
    } catch {
        // ignore
    }
    // legacy 'user_id' removed — update by 'id' or 'user' only.

    return { error: 'not_updated' }
}

/** Delete profile rows matching the given user id using available schema columns */
export async function deleteProfileByUserId(userId: string) {
    if (!userId) return { error: 'missing userId' }
    // try delete by primary key id first
    try {
        const { error } = await supabase.from('profiles').delete().eq('id', userId)
        if (!error) return { deleted: true }
    } catch {
        // ignore
    }
    // then try by 'user' column
    try {
        const { error } = await supabase.from('profiles').delete().eq('user', userId)
        if (!error) return { deleted: true }
    } catch {
        // ignore
    }
    // legacy 'user_id' removed — delete by 'id' or 'user' only.
    return { error: 'not_deleted' }
}

// Helper to compress videos on the client before uploading. Use this for any frontend
// uploads to ensure files are reasonable in size. It falls back to the original file on errors.
import { compressVideoFile } from './video'
export const uploadVideoWithCompression = async (bucket: string, path: string, file: File, options?: any) => {
    try {
        let toUpload = file
        if (file.type?.startsWith('video/')) {
            try {
                toUpload = await compressVideoFile(file)
            } catch (err) {
                console.warn('Video compression failed, uploading original', err)
                toUpload = file
            }
        }
        const { data, error } = await supabase.storage.from(bucket).upload(path, toUpload, options)
        return { data, error }
    } catch (err) {
        return { data: null, error: err }
    }
}
