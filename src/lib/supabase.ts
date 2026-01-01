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
    if (!filename || !id) return null
    try {
        const b = bucket || collection
        const path = `${id}/${filename}`
        const { data } = supabase.storage.from(b).getPublicUrl(path)
        return data?.publicUrl || null
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
    // try 'user'
    try {
        const { data, error } = await supabase.from('profiles').update(payload).eq('user', userId)
        if (!error) return { data, error: null }
    } catch {
        // ignore
    }
    // try 'id'
    try {
        const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId)
        if (!error) return { data, error: null }
    } catch {
        // ignore
    }
    // legacy 'user_id' removed — update by 'user' or 'id' only.

    return { error: 'not_updated' }
}

/** Delete profile rows matching the given user id using available schema columns */
export async function deleteProfileByUserId(userId: string) {
    if (!userId) return { error: 'missing userId' }
    try {
        const { error } = await supabase.from('profiles').delete().eq('user', userId)
        if (!error) return { deleted: true }
    } catch {
        // ignore
    }
    try {
        const { error } = await supabase.from('profiles').delete().eq('id', userId)
        if (!error) return { deleted: true }
    } catch {
        // ignore
    }
    // legacy 'user_id' removed — delete by 'user' or 'id' only.
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
