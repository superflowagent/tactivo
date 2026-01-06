// @ts-nocheck
/// <reference path="./deno.d.ts" />
// @ts-ignore: Deno remote module resolution is fine at runtime
import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';

// local fallback for the type checker
declare const Deno: any;

serve(async (req: any) => {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Secret, X-Admin-Token',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin',
  };
  if (origin !== '*') corsHeaders['Access-Control-Allow-Credentials'] = 'true';

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const jsonResponse = (body: any, status = 200) => {
    const h: Record<string, string> = { 'Content-Type': 'application/json', ...corsHeaders };
    return new Response(JSON.stringify(body), { status, headers: h });
  };

  try {
    const ADMIN_SECRET = (globalThis as any).Deno?.env?.get('ADMIN_SECRET');
    const SUPABASE_URL = (globalThis as any).Deno?.env?.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any).Deno?.env?.get(
      'SUPABASE_SERVICE_ROLE_KEY'
    );

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      return jsonResponse({ error: 'Supabase not configured' }, 500);

    // Helper to call Supabase REST for profiles using Service Role key
    const restProfiles = async (method: string, body?: any, query?: string) => {
      const url = `${SUPABASE_URL}/rest/v1/profiles${query ? `?${query}` : ''}`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=representation',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { ok: res.ok, status: res.status, data };
    };

    const authHeader = req.headers.get('authorization');
    const provided = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token');

    // Minimal ingress log
    console.info('update-professional called', {
      method: req.method,
      origin: req.headers.get('origin'),
    });

    // Validate caller: either ADMIN_SECRET provided or bearer token validated against auth/v1/user
    let callerUserId: string | null = null;
    if (!provided) {
      if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return jsonResponse({ error: 'Missing authorization header' }, 401);
      }
      const bearer = authHeader.substring(7);
      const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${bearer}`,
        },
      });
      if (!userResp.ok) {
        let authErr: any = null;
        try {
          authErr = await userResp.json();
        } catch {
          try {
            authErr = await userResp.text();
          } catch {
            authErr = null;
          }
        }
        return jsonResponse({ error: 'Invalid token', auth_error: authErr }, 401);
      }
      const userJson = await userResp.json();
      callerUserId = userJson.id;
      if (!callerUserId) return jsonResponse({ error: 'Invalid token' }, 401);
    } else {
      if (!ADMIN_SECRET) return jsonResponse({ error: 'ADMIN_SECRET not configured' }, 500);
      if (provided !== ADMIN_SECRET) return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (req.method !== 'PATCH') return jsonResponse({ error: 'Method not allowed' }, 405);

    const body = await req.json().catch(() => ({}));
    const { profile_id, id, user } = body || {};
    const targetId = profile_id || id || user;
    if (!targetId) return jsonResponse({ error: 'profile_id (or id/user) is required' }, 400);

    // Lookup existing profile
    const {
      ok: gotOk,
      status: gotStatus,
      data: gotData,
    } = await restProfiles('GET', undefined, `id=eq.${targetId}`);
    if (!gotOk || !gotData || (Array.isArray(gotData) && gotData.length === 0))
      return jsonResponse({ error: 'profile_not_found' }, 404);
    const profile = Array.isArray(gotData) ? gotData[0] : gotData;

    // Authorization check for bearer callers: ensure caller is admin OR editing own profile
    if (callerUserId) {
      const callerResp = await restProfiles('GET', undefined, `user=eq.${callerUserId}`);
      if (
        !callerResp.ok ||
        !callerResp.data ||
        (Array.isArray(callerResp.data) && callerResp.data.length === 0)
      )
        return jsonResponse({ error: 'caller_profile_missing' }, 403);
      const callerProfile = Array.isArray(callerResp.data) ? callerResp.data[0] : callerResp.data;
      if (
        !(
          callerProfile.role === 'admin' ||
          String(callerProfile.user) === String(targetId) ||
          String(callerProfile.id) === String(targetId)
        )
      ) {
        return jsonResponse({ error: 'forbidden' }, 403);
      }
    }

    // Prevent role escalation
    if (body.role && body.role !== 'professional') delete body.role;

    // Remove helper/identifying fields
    const sanitizedBody: any = { ...(body || {}) };
    if (sanitizedBody.profile_id) delete sanitizedBody.profile_id;
    if (sanitizedBody.id) delete sanitizedBody.id;

    // If photo_path provided and profile has no legacy 'photo' column, skip setting 'photo'
    try {
      if (
        sanitizedBody.photo_path &&
        (sanitizedBody.photo === undefined || sanitizedBody.photo === null)
      ) {
        if (profile && Object.prototype.hasOwnProperty.call(profile, 'photo')) {
          sanitizedBody.photo = sanitizedBody.photo_path;
        }
      }
    } catch (e) {
      /* ignore */
    }

    const upd = await restProfiles('PATCH', sanitizedBody, `id=eq.${targetId}`);
    if (!upd.ok) return jsonResponse({ error: 'failed_to_update_profile', details: upd }, 500);

    return jsonResponse({ ok: true, updated: upd.data }, 200);
  } catch (err: any) {
    return jsonResponse({ error: String(err?.message || err) }, 500);
  }
});
