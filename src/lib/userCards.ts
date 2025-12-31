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

        // Query profiles by user_id
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('user_id, name, last_name, photo, role, company, class_credits')
            .in('user_id', ids)

        if (error) throw error

        const map: Record<string, any> = {}
        for (const p of profiles || []) {
            map[p.user_id] = {
                user: p.user_id,
                name: p.name || '',
                last_name: p.last_name || '',
                photo: p.photo || null,
                photoUrl: p.photo ? getFilePublicUrl('users', p.user_id, p.photo) : null,
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

        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('user_id, name, last_name, photo, role, company, class_credits')
            .eq('company', companyId)
            .eq('role', role)
            .order('name', { ascending: true })

        if (error) throw error

        const records = (profiles || []).map((p: any) => ({
            user: p.user_id,
            id: p.user_id,
            name: p.name || '',
            last_name: p.last_name || '',
            photo: p.photo || null,
            photoUrl: p.photo ? getFilePublicUrl('users', p.user_id, p.photo) : null,
            role: p.role || null,
            company: p.company || null,
            class_credits: typeof p.class_credits !== 'undefined' ? p.class_credits : 0,
        }))

        return records
    } catch (err: any) {
        logError('Error fetching profiles by role:', err)
        return []
    }
}
