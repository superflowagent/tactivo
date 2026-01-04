import { supabase, getFilePublicUrl } from '@/lib/supabase'

export async function getProfilesByRole(companyId: string, role: string) {
    if (!companyId) return []

    try {
        if (role === 'professional') {
            const { data, error } = await supabase.rpc('get_profiles_by_role_for_professionals', { p_role: role })
            if (error) throw error
            return (data || []).map((r: any) => {
                const uid = r.user_id || r.user || r.id
                return {
                    id: uid,
                    ...r,
                    user: r.user_id || r.user,
                    photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null,
                }
            })
        } else {
            const { data, error } = await supabase.rpc('get_profiles_by_role_for_clients', { p_role: role })
            if (error) throw error
            return (data || []).map((r: any) => {
                const uid = r.user_id || r.user || r.id
                return {
                    id: uid,
                    ...r,
                    user: r.user_id || r.user,
                    photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null,
                }
            })
        }
    } catch (err) {
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
}

export async function getProfilesByIds(ids: string[]) {
    if (!ids || ids.length === 0) return {}
    const uniq = Array.from(new Set(ids))
    const map: Record<string, any> = {}

    try {
        const { data: profData, error: profErr } = await supabase.rpc('get_profiles_by_ids_for_professionals', { p_ids: uniq })
        if (!profErr && profData && profData.length > 0) {
            for (const r of profData) {
                const uid = r.user_id || r.user || r.id
                const rec = { ...r, id: uid, user: r.user_id || r.user, photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null }
                if (r.user_id) map[r.user_id] = rec
                if (r.id) map[r.id] = rec
            }
            return map
        }
    } catch (e) {
        // ignore and try client RPC
    }

    try {
        const { data: clientData, error: clientErr } = await supabase.rpc('get_profiles_by_ids_for_clients', { p_ids: uniq })
        if (clientErr) throw clientErr
        for (const r of clientData || []) {
            const uid = r.user_id || r.user || r.id
            const rec = { ...r, id: uid, user: r.user_id || r.user, photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null }
            if (r.user_id) map[r.user_id] = rec
            if (r.id) map[r.id] = rec
        }
        return map
    } catch (err) {
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
}
