import { supabase, getFilePublicUrl } from './supabase'
import { error as logError } from './logger'

/**
 * Migration note: we no longer use the `user_cards` collection.
 * Instead, fetch data directly from `profiles` (schema `public`).
 * These helpers provide a compatible shape for components that expect
 * `user_cards`-like objects (user, name, last_name, photo, class_credits, etc.).
 */

export async function syncUserCardOnUpsert(_userRecord: any) {
    // no-op under Supabase migration — user_cards table is deprecated
    // keeping the function to avoid churn; components call it asynchronously.
    return
}

export async function deleteUserCardForUser(_userId: string) {
    // no-op — no user_cards table
    return
}

export async function getUserCardsByIds(ids: string[]) {
    try {
        if (!ids || ids.length === 0) return {}

        // Query profiles: select core fields (no legacy `user_id`) and try user ids
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, user, name, last_name, photo_path, role, company, class_credits')
            .in('user', ids)

        // If searching by 'user' returned nothing, try primary key 'id'
        let results = profiles || []
        if ((!results || results.length === 0) && ids.length > 0) {
            const { data: profiles2, error: err2 } = await supabase.from('profiles').select('id, user, name, last_name, photo_path, role, company, class_credits').in('id', ids)
            if (!err2 && profiles2) results = profiles2
        }

        if (error) throw error

        const map: Record<string, any> = {}
        for (const p of results || []) {
            const uid = p.user || p.id
            map[uid] = {
                user: uid,
                name: p.name || '',
                last_name: p.last_name || '',
                photo: p.photo_path || null,
                photoUrl: p.photo_path ? getFilePublicUrl('users', uid, p.photo_path) : null,
                role: p.role || null,
                company: p.company || null,
                class_credits: typeof p.class_credits !== 'undefined' ? p.class_credits : 0,
            }
        }

        return map
    } catch (err: any) {
        logError('Error fetching profiles by ids:', err)
        return {}
    }
}

export async function getUserCardsByRole(companyId: string, role: string) {
    try {
        if (!companyId || !role) return []

        const cid = companyId

        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, user, name, last_name, photo_path, role, company, class_credits')
            .eq('company', cid)
            .eq('role', role)
            .order('name', { ascending: true })

        if (error) throw error

        const records = (profiles || []).map((p: any) => {
            const uid = p.user || p.id
            return {
                user: uid,
                id: uid,
                name: p.name || '',
                last_name: p.last_name || '',
                photo: p.photo_path || null,
                photoUrl: p.photo_path ? getFilePublicUrl('users', uid, p.photo_path) : null,
                role: p.role || null,
                company: p.company || null,
                class_credits: typeof p.class_credits !== 'undefined' ? p.class_credits : 0,
            }
        })


        return records
    } catch (err: any) {
        logError('Error fetching profiles by role:', err)
        return []
    }
}
