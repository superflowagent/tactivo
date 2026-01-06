import { supabase, getFilePublicUrl } from '@/lib/supabase';
import { error as logError } from '@/lib/logger';

export async function getProfilesByRole(companyId: string, role: string) {
    if (!companyId) return [];

    try {
        // Prefer secure RPCs that respect RLS/companies and run as SECURITY DEFINER
        if (role === 'professional') {
            const rpcPayload: any = { p_role: role };
            if (companyId) rpcPayload.p_company = companyId;
            const { data, error } = await supabase.rpc(
                'get_profiles_by_role_for_professionals',
                rpcPayload
            );
            if (error) {
                logError('RPC get_profiles_by_role_for_professionals error', error);
                throw error;
            }
            return (data || []).map((r: any) => {
                const uid = r.user_id || r.user || r.id;
                return {
                    id: uid,
                    ...r,
                    user: r.user_id || r.user,
                    photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null,
                };
            });
        } else {
            const rpcPayload: any = { p_role: role };
            if (companyId) rpcPayload.p_company = companyId;
            const { data, error } = await supabase.rpc('get_profiles_by_role_for_clients', rpcPayload);
            if (error) {
                logError('RPC get_profiles_by_role_for_clients error', error);
                throw error;
            }
            return (data || []).map((r: any) => {
                const uid = r.user_id || r.user || r.id;
                return {
                    id: uid,
                    ...r,
                    user: r.user_id || r.user,
                    photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null,
                };
            });
        }
    } catch (err) {
        // Do not fall back to a direct SELECT in the browser (it will 403 under RLS).
        // Surface the error to the caller to handle gracefully and avoid noisy 403 logs.
        logError('getProfilesByRole failed:', err);
        throw err;
    }
}

export function mapProfileRowsToMap(rows: any[] = []) {
    const map: Record<string, any> = {};
    for (const r of rows || []) {
        const uid = r.user_id || r.user || r.id;
        const rec = {
            ...r,
            id: uid,
            user: r.user_id || r.user,
            photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null,
        };
        if (r.user_id) map[r.user_id] = rec;
        if (r.id) map[r.id] = rec;
        map[uid] = rec;
    }
    return map;
}

export async function getProfilesByIds(ids: string[], companyId?: string) {
    if (!ids || ids.length === 0) return {};
    const uniq = Array.from(new Set(ids));

    try {
        const rpcPayload: any = { p_ids: uniq };
        if (companyId) rpcPayload.p_company = companyId;
        const { data: profData, error: profErr } = await supabase.rpc(
            'get_profiles_by_ids_for_professionals',
            rpcPayload
        );
        if (!profErr && profData && profData.length > 0) {
            return mapProfileRowsToMap(profData);
        }
    } catch {
        // ignore and try client RPC
    }

    const map: Record<string, any> = {};

    try {
        const { data: clientData, error: clientErr } = await supabase.rpc(
            'get_profiles_by_ids_for_clients',
            companyId ? { p_ids: uniq, p_company: companyId } : { p_ids: uniq }
        );
        if (clientErr) throw clientErr;
        for (const r of clientData || []) {
            const uid = r.user_id || r.user || r.id;
            const rec = {
                ...r,
                id: uid,
                user: r.user_id || r.user,
                photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null,
            };
            if (r.user_id) map[r.user_id] = rec;
            if (r.id) map[r.id] = rec;
        }
        return map;
    } catch {
        const [{ data: byUser }, { data: byId }] = await Promise.all([
            (companyId
                ? supabase.from('profiles').select('id, user, name, last_name, email, phone, photo_path, sport, class_credits').eq('company', companyId).in('user', uniq)
                : supabase.from('profiles').select('id, user, name, last_name, email, phone, photo_path, sport, class_credits').in('user', uniq)),
            (companyId
                ? supabase.from('profiles').select('id, user, name, last_name, email, phone, photo_path, sport, class_credits').eq('company', companyId).in('id', uniq)
                : supabase.from('profiles').select('id, user, name, last_name, email, phone, photo_path, sport, class_credits').in('id', uniq)),
        ]);

        const rows = [...(byUser || []), ...(byId || [])];
        for (const r of rows) {
            const { id: rid, ...rest } = r;
            const uid = r.user || rid;
            const rec = {
                ...rest,
                id: uid,
                user: r.user || rid,
                photoUrl: r.photo_path ? getFilePublicUrl('profile_photos', uid, r.photo_path) : null,
            };
            if (r.user) map[r.user] = rec;
            if (rid) map[rid] = rec;
        }

        return map;
    }
}
