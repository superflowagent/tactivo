// @ts-nocheck
/// <reference path="./deno.d.ts" />
// @ts-ignore: Deno remote module resolution is fine at runtime
import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';
serve(async (req) => {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Secret, X-Admin-Token',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin'
  };
  if (origin !== '*') corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  const jsonResponse = (body, status = 200) => {
    const h = {
      'Content-Type': 'application/json',
      ...corsHeaders
    };
    return new Response(JSON.stringify(body), {
      status,
      headers: h
    });
  };
  try {
    const ADMIN_SECRET = globalThis.Deno?.env?.get('ADMIN_SECRET');
    const SUPABASE_URL = globalThis.Deno?.env?.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = globalThis.Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({
      error: 'Supabase not configured'
    }, 500);

    const getAdminSecret = async () => {
      try {
        const env = globalThis.Deno?.env?.get('ADMIN_SECRET');
        if (env) return env;
        try {
          const txt = await Deno.readTextFile('./.local_admin_secret');
          if (txt) return txt.trim();
        } catch (e) {
          // ignore
        }
        const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/app_settings?select=value&key=eq.ADMIN_SECRET`;
        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        if (Array.isArray(json) && json.length) return json[0].value || null;
        return null;
      } catch (e) {
        return null;
      }
    };
    // Helper to call Supabase REST for profiles using Service Role key
    const restProfiles = async (method, body, query) => {
      const url = `${SUPABASE_URL}/rest/v1/profiles${query ? `?${query}` : ''}`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=representation'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return {
        ok: res.ok,
        status: res.status,
        data
      };
    };
    // Helper to call Supabase REST for companies using Service Role key
    const restCompanies = async (method, body, query) => {
      const url = `${SUPABASE_URL}/rest/v1/companies${query ? `?${query}` : ''}`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: 'return=representation'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return {
        ok: res.ok,
        status: res.status,
        data
      };
    };
    const authHeader = req.headers.get('authorization');
    const provided = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token');
    // Basic ingress info for operational visibility
    console.info('update-company called', {
      method: req.method,
      origin: req.headers.get('origin')
    });
    // Validate caller: either ADMIN_SECRET provided or bearer token validated against auth/v1/user
    let callerUserId = null;
    if (!provided) {
      if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return jsonResponse({
          error: 'Missing authorization header'
        }, 401);
      }
      const bearer = authHeader.substring(7);
      // Validate token by calling auth/v1/user (include apikey for robust validation)
      const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${bearer}`
        }
      });
      if (!userResp.ok) {
        return jsonResponse({
          error: 'Invalid token'
        }, 401);
      }
      const userJson = await userResp.json();
      callerUserId = userJson.id;
      if (!callerUserId) return jsonResponse({
        error: 'Invalid token'
      }, 401);
    } else {
      // Admin secret provided, proceed as admin
      const adminSecret = await getAdminSecret();
      if (!adminSecret) return jsonResponse({
        error: 'ADMIN_SECRET not configured'
      }, 500);
      if (provided !== adminSecret) return jsonResponse({
        error: 'Unauthorized'
      }, 401);
    }
    if (req.method !== 'PATCH') return jsonResponse({
      error: 'Method not allowed'
    }, 405);
    // Parse body
    const body = await req.json().catch(() => ({}));
    const { company_id, id } = body || {};
    const targetId = company_id || id;
    if (!targetId) {
      console.warn('update-company missing target id', {
        body
      });
      return jsonResponse({
        error: 'company_id (or id) is required'
      }, 400);
    }
    // Lookup existing company
    const { ok: gotOk, status: gotStatus, data: gotData } = await restCompanies('GET', undefined, `id=eq.${targetId}`);
    if (!gotOk || !gotData || Array.isArray(gotData) && gotData.length === 0) return jsonResponse({
      error: 'company_not_found'
    }, 404);
    const company = Array.isArray(gotData) ? gotData[0] : gotData;
    // Authorization check for bearer callers: ensure caller belongs to same company and has role to edit
    if (callerUserId) {
      const callerResp = await restProfiles('GET', undefined, `user=eq.${callerUserId}`);
      if (!callerResp.ok || !callerResp.data || Array.isArray(callerResp.data) && callerResp.data.length === 0) return jsonResponse({
        error: 'caller_profile_missing'
      }, 403);
      const callerProfile = Array.isArray(callerResp.data) ? callerResp.data[0] : callerResp.data;
      // Only allow if caller is admin or professional and same company
      if (![
        'admin',
        'professional'
      ].includes(callerProfile.role || '') || String(callerProfile.company) !== String(company.id)) {
        return jsonResponse({
          error: 'forbidden'
        }, 403);
      }
    }
    // Remove helper/identifying fields from body so PostgREST doesn't try to update non-existent columns
    const sanitizedBody = {
      ...body || {}
    };
    if (sanitizedBody.company_id) delete sanitizedBody.company_id;
    if (sanitizedBody.id) delete sanitizedBody.id;
    // Perform update using service role
    const upd = await restCompanies('PATCH', sanitizedBody, `id=eq.${targetId}`);
    if (!upd.ok) return jsonResponse({
      error: 'failed_to_update_company',
      details: upd.data
    }, 500);
    return jsonResponse({
      ok: true,
      updated: upd.data
    }, 200);
  } catch (err) {
    return jsonResponse({
      error: String(err?.message || err)
    }, 500);
  }
});
