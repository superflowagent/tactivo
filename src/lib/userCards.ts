import { supabase, getFilePublicUrl } from '@/lib/supabase'

/**
 * Compatibility helpers for legacy `user_cards` usage.
 * These functions provide a minimal wrapper over `profiles` so older components keep working
 * while the app transitions to querying `profiles` directly.
 */
export async function getUserCardsByRole(companyId: string, role: string) {
    if (!companyId) return []
    const { data, error } = await supabase.from('profiles')
        .select('id, user, name, last_name, email, phone, photo_path, sport, class_credits')
        .eq('company', companyId).eq('role', role).order('name')
    if (error) throw error
    return (data || []).map((r: any) => {
        const uid = r.user || r.id
        return {
            id: uid,
            ...r,
            photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null,
        }
    })
}

export async function getUserCardsByIds(ids: string[]) {
    if (!ids || ids.length === 0) return {}
    const uniq = Array.from(new Set(ids))
    const map: Record<string, any> = {}

    // Query by both `user` and primary `id` to be robust against schema variations
    const [{ data: byUser }, { data: byId }] = await Promise.all([
        supabase.from('profiles').select('id, user, name, last_name, email, phone, photo_path, sport, class_credits').in('user', uniq),
        supabase.from('profiles').select('id, user, name, last_name, email, phone, photo_path, sport, class_credits').in('id', uniq),
    ])

    const rows = [...(byUser || []), ...(byId || [])]
    for (const r of rows) {
        const { id: rid, ...rest } = r
        const uid = r.user || rid
        const rec = { ...rest, id: uid, user: r.user || rid, photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null }
        if (r.user) map[r.user] = rec
        if (rid) map[rid] = rec
    }

    return map
}

// Best-effort compatibility stubs used by a few places — do not fail if not available.
export function syncUserCardOnUpsert(_profile: any) {
    // Intentionally a no-op: previously this synced a derived `user_cards` table. The app now reads `profiles` directly.
    return null
}

export function deleteUserCardForUser(_userId: string) {
    // No-op: kept for backward compatibility with code paths that still call this helper.
    return null
} 
