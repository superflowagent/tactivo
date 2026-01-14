import { supabase, getFilePublicUrl } from '@/lib/supabase';
import { error as logError } from '@/lib/logger';

// Utility: remove undefined/null fields from RPC payloads to avoid server-side ambiguity
const cleanRpcPayload = (obj: any) => {
  const out: any = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
};

export async function getProfilesByRole(companyId: string, role: string) {
  if (!companyId) return [];

  try {
    // Prefer secure RPCs that respect RLS/companies and run as SECURITY DEFINER
    if (role === 'professional') {
      const rpcPayload: any = { p_role: role };
      if (companyId && /^[0-9a-fA-F-]{36}$/.test(companyId)) rpcPayload.p_company = companyId;
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
      if (companyId && /^[0-9a-fA-F-]{36}$/.test(companyId)) rpcPayload.p_company = companyId;
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
    if (companyId && /^[0-9a-fA-F-]{36}$/.test(companyId)) rpcPayload.p_company = companyId;

    // Try both RPCs and merge their results so we don't miss clients when the
    // 'professionals' RPC returns non-empty results for mixed id sets.
    let profRows: any[] = [];
    try {
      const profRpcPayload = cleanRpcPayload(rpcPayload);
      const { data: profData, error: profErr } = await supabase.rpc(
        'get_profiles_by_ids_for_professionals',
        profRpcPayload
      );
      if (!profErr && profData && profData.length > 0) profRows = profData;
    } catch {
      // ignore professionals RPC errors and continue to clients RPC
    }

    let clientRows: any[] = [];
    try {
      const clientRpcPayload: any = { p_ids: uniq };
      if (companyId && /^[0-9a-fA-F-]{36}$/.test(companyId)) clientRpcPayload.p_company = companyId;
      const clientRpcToSend = cleanRpcPayload(clientRpcPayload);
      const { data: clientData, error: clientErr } = await supabase.rpc(
        'get_profiles_by_ids_for_clients',
        clientRpcToSend
      );
      if (!clientErr && clientData && clientData.length > 0) clientRows = clientData;
    } catch {
      // ignore clients RPC errors; we'll fall back to direct SELECT below if needed
    }

    // If we got any rows from either RPC, map & return them (merged)
    const combined = [...profRows, ...clientRows];
    if (combined.length > 0) {
      return mapProfileRowsToMap(combined as any[]);
    }
  } catch {
    // ignore and fall back to direct SELECTs below
  }

  const map: Record<string, any> = {};

  try {
    const [{ data: byUser }, { data: byId }] = await Promise.all([
      companyId
        ? supabase
            .from('profiles')
            .select('id, user, name, last_name, email, phone, photo_path, sport, class_credits')
            .eq('company', companyId)
            .in('user', uniq)
        : supabase
            .from('profiles')
            .select('id, user, name, last_name, email, phone, photo_path, sport, class_credits')
            .in('user', uniq),
      companyId
        ? supabase
            .from('profiles')
            .select('id, user, name, last_name, email, phone, photo_path, sport, class_credits')
            .eq('company', companyId)
            .in('id', uniq)
        : supabase
            .from('profiles')
            .select('id, user, name, last_name, email, phone, photo_path, sport, class_credits')
            .in('id', uniq),
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
  } catch (err) {
    // If everything fails, return empty map (caller should handle missing profiles)
    logError('getProfilesByIds fallback SELECT failed', err);
    return map;
  }
}

// Normalize and validate arrays of client profile/user ids -> canonical profile.id
export async function normalizeAndValidateClientIds(ids: string[] | undefined) {
  if (!ids || ids.length === 0) return [] as string[];
  const isUuid = (s: any) => typeof s === 'string' && /^[0-9a-fA-F-]{36}$/.test(s);
  const uniq = Array.from(new Set(ids || [])).filter(Boolean);

  const out: string[] = [];
  const problematic: string[] = [];

  // Basic UUID validation
  for (const id of uniq) {
    if (!isUuid(id)) {
      problematic.push(String(id));
    }
  }

  if (problematic.length > 0) {
    throw new Error('Clientes inválidos: ' + problematic.join(', '));
  }

  const profilesMap = await getProfilesByIds(uniq);

  for (const id of uniq) {
    const p = profilesMap[String(id)];
    if (!p) {
      problematic.push(String(id));
      continue;
    }

    // Invite validation (same behaviour as previous frontend helper)
    if (p.invite_token) {
      const expires = p.invite_expires_at ? new Date(p.invite_expires_at) : null;
      if (!expires || expires.getTime() <= Date.now()) {
        problematic.push(p.email || String(id));
        continue;
      }
    }

    out.push(p.id || p.user || String(id));
  }

  if (problematic.length > 0) {
    throw new Error('Clientes inválidos o con invitación inválida: ' + problematic.join(', '));
  }

  return out;
}

// Normalize array of professional ids -> canonical profile.id
export async function normalizeAndValidateProfessionalIds(ids: string[] | undefined) {
  if (!ids || ids.length === 0) return [] as string[];
  const isUuid = (s: any) => typeof s === 'string' && /^[0-9a-fA-F-]{36}$/.test(s);
  const uniq = Array.from(new Set(ids || [])).filter(Boolean);

  const out: string[] = [];
  const problematic: string[] = [];

  for (const id of uniq) {
    if (!isUuid(id)) {
      problematic.push(String(id));
    }
  }

  if (problematic.length > 0) {
    throw new Error('Profesionales inválidos: ' + problematic.join(', '));
  }

  const profilesMap = await getProfilesByIds(uniq);

  for (const id of uniq) {
    const p = profilesMap[String(id)];
    if (!p) {
      problematic.push(String(id));
      continue;
    }
    out.push(p.id || p.user || String(id));
  }

  if (problematic.length > 0) {
    throw new Error('Profesionales inválidos: ' + problematic.join(', '));
  }

  return out;
}
