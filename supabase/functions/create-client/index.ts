// @ts-nocheck
/// <reference path="./deno.d.ts" />
// @ts-ignore: Deno remote module resolution is fine at runtime
import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';
serve(async (req)=>{
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  const jsonResponse = (body, status = 200)=>{
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
    const SUPABASE_URL = globalThis.Deno?.env?.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = globalThis.Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({
      error: 'Supabase not configured'
    }, 500);
    const getAdminSecret = async ()=>{
      try {
        const env = globalThis.Deno?.env?.get('ADMIN_SECRET');
        if (env) return env;
        try {
          const txt = await Deno.readTextFile('./.local_admin_secret');
          if (txt) return txt.trim();
        } catch (e) {
        // ignore - fallback not present
        }
        // Fallback: read from public.app_settings via service role key
        const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/app_settings?select=value&key=eq.ADMIN_SECRET`;
        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        if (!res.ok) return null;
        const json = await res.json().catch(()=>null);
        if (Array.isArray(json) && json.length) return json[0].value || null;
        return null;
      } catch (e) {
        return null;
      }
    };
    // Helper to call Supabase REST for profiles using Service Role key
    const restProfiles = async (method, body, query)=>{
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
      } catch  {
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
    // Validate caller: either ADMIN_SECRET provided or bearer token validated against auth/v1/user
    let callerUserId = null;
    if (!provided) {
      if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return jsonResponse({
          error: 'Missing authorization header'
        }, 401);
      }
      const bearer = authHeader.substring(7);
      const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${bearer}`
        }
      });
      if (!userResp.ok) {
        let authErr = null;
        try {
          authErr = await userResp.json();
        } catch  {
          try {
            authErr = await userResp.text();
          } catch  {
            authErr = null;
          }
        }
        return jsonResponse({
          error: 'Invalid token',
          auth_error: authErr
        }, 401);
      }
      const userJson = await userResp.json();
      callerUserId = userJson.id;
      if (!callerUserId) return jsonResponse({
        error: 'Invalid token'
      }, 401);
    } else {
      const adminSecret = await getAdminSecret();
      if (!adminSecret) return jsonResponse({
        error: 'ADMIN_SECRET not configured'
      }, 500);
      if (provided !== adminSecret) return jsonResponse({
        error: 'Unauthorized'
      }, 401);
    }
    if (req.method !== 'POST') return jsonResponse({
      error: 'Method not allowed'
    }, 405);
    const body = await req.json().catch(()=>({}));
    // Required fields: company, user (optional — may be assigned later), name
    const { company, user, name, last_name, dni, email, phone } = body || {};
    if (!company) return jsonResponse({
      error: 'company is required'
    }, 400);
    if (!name && !email) return jsonResponse({
      error: 'name or email is required'
    }, 400);
    // Authorization check for bearer callers (ensure caller is professional of same company)
    if (callerUserId) {
      const caller = await restProfiles('GET', undefined, `user=eq.${callerUserId}`);
      if (!caller.ok || !caller.data || Array.isArray(caller.data) && caller.data.length === 0) return jsonResponse({
        error: 'caller_profile_missing'
      }, 403);
      const callerProfile = Array.isArray(caller.data) ? caller.data[0] : caller.data;
      if (!(callerProfile.role === 'professional' || callerProfile.role === 'admin')) return jsonResponse({
        error: 'forbidden_role'
      }, 403);
      if (String(callerProfile.company) !== String(company)) return jsonResponse({
        error: 'forbidden_company'
      }, 403);
    }
    // Build new profile payload and force role to 'client'
    const newProfile = {
      company,
      role: 'client'
    };
    if (user) newProfile.user = user;
    if (name) newProfile.name = name;
    if (last_name) newProfile.last_name = last_name;
    if (dni) newProfile.dni = dni;
    if (email) newProfile.email = email;
    if (phone) newProfile.phone = phone;
    // Insert using service role key
    const insertRes = await restProfiles('POST', newProfile);
    if (!insertRes.ok) {
      console.error('create-client: restProfiles POST failed', JSON.stringify(insertRes));
      return jsonResponse({
        error: 'failed_to_insert',
        details: insertRes
      }, 500);
    }
    // Return inserted row(s)
    return jsonResponse({
      ok: true,
      inserted: insertRes.data
    }, 201);
  } catch (err) {
    return jsonResponse({
      error: String(err?.message || err)
    }, 500);
  }
});
