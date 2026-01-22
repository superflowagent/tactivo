// @ts-nocheck
/// <reference path="./deno.d.ts" />
import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';
serve(async (req) => {
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
    const SUPABASE_URL = globalThis.Deno?.env?.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = globalThis.Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');
    const ADMIN_SECRET = globalThis.Deno?.env?.get('ADMIN_SECRET');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({
      error: 'Supabase not configured'
    }, 500);

    const getAdminSecret = async () => {
      try {
        const env = globalThis.Deno?.env?.get('ADMIN_SECRET');
        if (env) return env;
        // Local file fallback for developer convenience (kept out of git via .gitignore)
        try {
          const txt = await Deno.readTextFile('./.local_admin_secret');
          if (txt) return txt.trim();
        } catch (e) {
          // ignore missing file
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
      // Validate token by calling auth/v1/user using service_role for robust validation
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
    const body = await req.json().catch(() => ({}));
    const { bucket, company_id, exercise_id, filename, content_b64, content_type } = body || {};
    // If root flag is provided, company_id and exercise_id are not required. Otherwise both are mandatory.
    if (!bucket || !filename || !content_b64 || !content_type || !body.root && (!company_id || !exercise_id)) {
      return jsonResponse({
        error: 'bucket, filename, content_b64, content_type and (exercise_id and company_id when root not set) are required'
      }, 400);
    }
    // Verify caller belongs to the company (unless admin-secret used)
    if (callerUserId) {
      const profileResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user=eq.${callerUserId}`, {
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
      if (!profileResp.ok) return jsonResponse({
        error: 'caller_profile_missing'
      }, 403);
      const txt = await profileResp.text();
      let profileData = null;
      try {
        profileData = JSON.parse(txt);
      } catch {
        profileData = txt;
      }
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      if (!profile) return jsonResponse({
        error: 'caller_profile_missing'
      }, 403);
      if (String(profile.company) !== String(company_id)) return jsonResponse({
        error: 'forbidden'
      }, 403);
    }
    // If 'root' flag provided, upload to bucket root (filename only). Otherwise store under company/exercise folder for legacy behavior.
    const path = body.root ? `${filename}` : `${company_id}/${exercise_id}/${filename}`;
    // Decode base64 to bytes
    const bytes = Uint8Array.from(atob(content_b64), (c) => c.charCodeAt(0));
    // Call Supabase Storage REST as service role to upload the file
    const uploadUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
    const uploadResp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': content_type,
        'x-upsert': 'true'
      },
      body: bytes
    });
    const uploadTxt = await uploadResp.text();
    let uploadJson = null;
    try {
      uploadJson = JSON.parse(uploadTxt);
    } catch {
      uploadJson = uploadTxt;
    }
    if (!uploadResp.ok) {
      return jsonResponse({
        error: 'upload_failed',
        status: uploadResp.status,
        details: uploadJson
      }, 500);
    }
    return jsonResponse({
      ok: true,
      uploaded: {
        bucket,
        path
      }
    }, 200);
  } catch (err) {
    return jsonResponse({
      error: String(err?.message || err)
    }, 500);
  }
});
