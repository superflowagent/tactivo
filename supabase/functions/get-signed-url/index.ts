// @ts-nocheck
/// <reference path="./deno.d.ts" />
// Lightweight function to return a signed URL for a storage object using the Service Role key
import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Secret',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin'
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  try {
    const SUPABASE_URL = globalThis.Deno?.env?.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = globalThis.Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({ error: 'Supabase not configured' }, 500);
    // Debug: log header keys to help diagnose auth issues (do not print values)
    try {
      const keys = [];
      for (const k of req.headers.keys()) keys.push(k);
      console.info('get-signed-url headers:', keys.join(','));
    } catch (e) {
      // ignore
    }

    // Basic auth: allow bearer tokens validated against /auth/v1/user OR a valid admin secret
    const authHeader = req.headers.get('authorization');
    const providedHeader = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token');
    // Allow admin secret in request body for local development if headers are stripped
    const providedBody = ((await req.json().catch(() => null)) || {}).admin_secret || null;
    const provided = providedHeader || providedBody;
    console.info('get-signed-url: authHeader present=', !!authHeader, 'provided header/body present=', !!provided);
    try { console.info('get-signed-url: authHeader preview=', authHeader ? authHeader.slice(0, 20) : null); } catch (e) { }
    let authorized = false;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const bearer = authHeader.substring(7);
      console.info('get-signed-url: bearer token len=', bearer ? bearer.length : 0);
      console.info('get-signed-url: service role len=', SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY.length : 0);
      // Allow service role key to act as admin in local development (authorizes signing)
      if (bearer === SUPABASE_SERVICE_ROLE_KEY) {
        authorized = true;
        console.info('get-signed-url: authorized via service role token');
      } else {
        const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${bearer}` }
        });
        if (userResp.ok) {
          authorized = true;
          console.info('get-signed-url: authorized via user token');
        }
      }
    }
    if (!authorized && provided) {
      // quick flag log for debugging (do not print secrets)
      console.info('get-signed-url: provided header present (masked) len=', provided ? provided.length : 0);
      // compare with admin secret (try env first)
      const adminEnv = globalThis.Deno?.env?.get('ADMIN_SECRET');
      if (adminEnv && provided === adminEnv) {
        authorized = true;
        console.info('get-signed-url: authorized via ADMIN_SECRET env');
      } else {
        // Try local file fallback used in development
        try {
          const candidates = ['./.local_admin_secret', '/var/task/.local_admin_secret', './supabase/.local_admin_secret', '../.local_admin_secret'];
          for (const p of candidates) {
            try {
              const txt = await Deno.readTextFile(p);
              console.info('get-signed-url: found local file', p, 'len=', txt ? txt.trim().length : 0);
              if (txt && txt.trim() === provided) {
                authorized = true;
                console.info('get-signed-url: authorized via local file', p);
                break;
              }
            } catch (e) {
              // ignore missing file
            }
          }
        } catch (e) {
          console.info('get-signed-url: local file checks failed', String(e?.message || e));
        }
      }
      if (!authorized) {
        // try DB fallback (if available)
        try {
          const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/app_settings?select=value&key=eq.ADMIN_SECRET`;
          const res = await fetch(url, { headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
          if (res.ok) {
            const json = await res.json().catch(() => null);
            console.info('get-signed-url: app_settings read count=', Array.isArray(json) ? json.length : 0);
            if (Array.isArray(json) && json.length && json[0].value === provided) {
              authorized = true;
              console.info('get-signed-url: authorized via app_settings');
            }
          }
        } catch (err) {
          console.info('get-signed-url: app_settings check failed', String(err?.message || err));
        }
      }
    }
    if (!authorized) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const { bucket, path, expires = 3600 } = body || {};
    if (!bucket || !path) return jsonResponse({ error: 'bucket and path required' }, 400);

    const signUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
    const signResp = await fetch(signUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ expiresIn: expires })
    });
    const txt = await signResp.text();
    let json = null;
    try { json = JSON.parse(txt); } catch { json = txt; }
    if (!signResp.ok) return jsonResponse({ error: 'sign_failed', details: json, status: signResp.status }, 500);
    return jsonResponse({ ok: true, signedUrl: json.signedUrl || json?.signed_url || null });
  } catch (err) {
    return jsonResponse({ error: String(err?.message || err) }, 500);
  }
});