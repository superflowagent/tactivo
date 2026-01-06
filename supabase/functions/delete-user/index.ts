// @ts-ignore - Deno std library import in Supabase Edge function (editor may not resolve remote types)
import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';

// Minimal Deno env declaration so the editor/TypeScript doesn't complain about the global `Deno` object
declare const Deno: { env: { get(name: string): string | undefined } };

serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      return jsonResponse({ error: 'Supabase not configured' }, 500);

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

    // Require a Bearer token from an authenticated user (professionals only)
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
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
        authErr = null;
      }
      return jsonResponse({ error: 'Invalid token', auth_error: authErr }, 401);
    }
    const userJson = await userResp.json();
    const callerUserId = userJson.id;
    if (!callerUserId) return jsonResponse({ error: 'Invalid token' }, 401);

    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    const body = await req.json().catch(() => ({}));
    const { profile_id } = body;
    if (!profile_id) return jsonResponse({ error: 'profile_id is required' }, 400);

    // Lookup profile
    const prof = await restProfiles('GET', undefined, `id=eq.${profile_id}`);
    if (!prof.ok || !prof.data || (Array.isArray(prof.data) && prof.data.length === 0))
      return jsonResponse({ error: 'profile_not_found' }, 404);
    const profile = Array.isArray(prof.data) ? prof.data[0] : prof.data;

    // Authorization: ensure caller belongs to same company and is a professional
    try {
      const caller = await restProfiles('GET', undefined, `user=eq.${callerUserId}`);
      if (!caller.ok || !caller.data || (Array.isArray(caller.data) && caller.data.length === 0))
        return jsonResponse({ error: 'caller_profile_missing' }, 403);
      const callerProfile = Array.isArray(caller.data) ? caller.data[0] : caller.data;
      if (
        (callerProfile.role || '') !== 'professional' ||
        String(callerProfile.company) !== String(profile.company)
      ) {
        return jsonResponse({ error: 'forbidden' }, 403);
      }
    } catch (e: any) {
      return jsonResponse({ error: String(e?.message || e) }, 500);
    }

    // Attempt to delete auth user if present
    const authUserId = profile.user || null;
    let deletedAuth: any = null;
    if (authUserId) {
      try {
        const delUserResp = await fetch(
          `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${authUserId}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
          }
        );
        const text = await delUserResp.text().catch(() => null);
        let json: any = null;
        try {
          if (text) json = JSON.parse(text);
        } catch {
          json = text;
        }
        deletedAuth = { ok: delUserResp.ok, status: delUserResp.status, body: json };
      } catch (e: any) {
        deletedAuth = { error: String(e?.message || e) };
      }
    }

    // Delete profile row (service role)
    const deletedProfile = await restProfiles('DELETE', undefined, `id=eq.${profile_id}`);

    return jsonResponse(
      { ok: true, profile_id, auth_user: authUserId, deletedAuth, deletedProfile },
      200
    );
  } catch (err: any) {
    return jsonResponse({ error: String(err?.message || err) }, 500);
  }
});
