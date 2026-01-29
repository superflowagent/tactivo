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
  if (req.method === 'OPTIONS') return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
  const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
  try {
    const SUPABASE_URL = globalThis.Deno?.env?.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = globalThis.Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({
      error: 'Supabase not configured'
    }, 500);
    // Debug: log header keys to help diagnose auth issues (do not print values)
    // Basic auth: allow bearer tokens validated against /auth/v1/user OR a valid admin secret
    const authHeader = req.headers.get('authorization');
    const providedHeader = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token');
    // Read raw body text and parse
    const rawBody = await req.text().catch(() => null);
    let parsedBody = null;
    try { parsedBody = rawBody ? JSON.parse(rawBody) : null; } catch (e) { parsedBody = null; }
    // Allow admin secret in request body for local development if headers are stripped
    const providedBody = (parsedBody || {}).admin_secret || null;
    const provided = providedHeader || providedBody;
    let authorized = false;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const bearer = authHeader.substring(7);
      // Allow service role key to act as admin in local development (authorizes signing)
      if (bearer === SUPABASE_SERVICE_ROLE_KEY) {
        authorized = true;
      } else {
        const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${bearer}`
          }
        });
        if (userResp.ok) {
          authorized = true;
        }
      }
    }
    if (!authorized && provided) {
      // quick flag log for debugging (do not print secrets)
      // compare with admin secret (try env first)
      const adminEnv = globalThis.Deno?.env?.get('ADMIN_SECRET');
      if (adminEnv && provided === adminEnv) {
        authorized = true;
      } else {
        // Try local file fallback used in development
        try {
          const candidates = [
            './.local_admin_secret',
            '/var/task/.local_admin_secret',
            './supabase/.local_admin_secret',
            './functions/.local_admin_secret',
            '../.local_admin_secret'
          ];
          for (const p of candidates) {
            try {
              const txt = await (Deno as any).readTextFile(p);
              if (txt && txt.trim() === provided) {
                authorized = true;
                break;
              }
            } catch (e) {
              // ignore missing file
            }
          }
        } catch (e) {
          // ignore
        }

        // Development shortcut: if running locally (SUPABASE_URL points to localhost/127.0.0.1/kong)
        // and a provided secret is present, accept it as authorization to ease local dev.
        try {
          if (!authorized && SUPABASE_URL && (SUPABASE_URL.includes('127.0.0.1') || SUPABASE_URL.includes('localhost') || SUPABASE_URL.includes('kong'))) {
            authorized = true;

          }
        } catch (e) {
          // ignore
        }
      }
      if (!authorized) {
        // try DB fallback (if available)
        try {
          const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/app_settings?select=value&key=eq.ADMIN_SECRET`;
          const res = await fetch(url, {
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
          });
          if (res.ok) {
            const json = await res.json().catch(() => null);
            if (Array.isArray(json) && json.length && json[0].value === provided) {
              authorized = true;
            }
          }
        } catch (err) {
          console.info('get-signed-url: app_settings check failed', String(err?.message || err));
        }
      }
    }
    // Development shortcut: when running locally, allow signing requests without auth to ease dev. See notes in repo.
    try {
      if (!authorized && SUPABASE_URL && (SUPABASE_URL.includes('127.0.0.1') || SUPABASE_URL.includes('localhost') || SUPABASE_URL.includes('kong'))) {
        authorized = true;
      }
    } catch (e) {
      // ignore
    }

    if (!authorized) return jsonResponse({
      error: 'Unauthorized'
    }, 401);
    // Use parsed body from earlier
    const body = parsedBody || {};
    try {
      console.info('get-signed-url: parsedBody keys=', body ? Object.keys(body) : null);
    } catch (e) { }
    const { bucket, path, expires = 3600 } = body || {};
    if (!bucket || !path) return jsonResponse({
      error: 'bucket and path required'
    }, 400);
    // Encode individual path segments (so '/' remains a path separator rather than being encoded to '%2F')
    const encodedPath = String(path).split('/').map(p => encodeURIComponent(p)).join('/');
    const signUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`;
    const signResp = await fetch(signUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        expiresIn: expires
      })
    }).catch(e => {
      // Log fetch error in dev only
      if (typeof Deno !== 'undefined' && (Deno as any).env && (Deno as any).env.get && (Deno as any).env.get('NODE_ENV') === 'development') {
        try { console.info('get-signed-url: fetch signUrl threw', String(e?.message || e)); } catch (e) { }
      }
      throw e;
    });
    const txt = await signResp.text();
    let json = null;
    try {
      json = JSON.parse(txt);
    } catch {
      json = txt;
    }
    if (!signResp.ok) {
      // Map storage API 'not found' to a clear 404 response for callers.
      // Some storage versions return a 400 with a body containing { error: 'not_found' } — handle both.
      const bodyIndicatesNotFound =
        signResp.status === 404 ||
        json?.error === 'not_found' ||
        String(json?.statusCode) === '404' ||
        (json?.message && String(json.message).toLowerCase().includes('not found'));
      if (bodyIndicatesNotFound) {
        // Return 200 so client-side fetch does not surface a network 404 in the browser console.
        // The body indicates the caller that the object is missing via ok:false and status:404.
        return jsonResponse({ ok: false, error: 'object_not_found', status: 404 }, 200);
      }
      return jsonResponse({
        error: 'sign_failed',
        details: json,
        status: signResp.status
      }, 500);
    }
    const signed = json.signedUrl || json?.signed_url || null;
    // Accept multiple signed URL keys returned by different storage API versions
    const signedAlt = json?.signedUrl || json?.signed_url || json?.signedURL || null;
    // Normalize signed URL returned by storage API so it's reachable from the browser.
    // Prefer SUPABASE_URL as the origin (includes proper host/port in local dev).
    let finalSigned = signedAlt;
    if (signedAlt) {
      try {
        // If the storage API returned a relative path (starting with '/'), just prefix SUPABASE_URL
        if (String(signedAlt).startsWith('/')) {
          // Storage returned a relative path like '/object/sign/..'
          // Kong routes those under '/storage/v1/object/sign' for external access
          let path = String(signedAlt);
          if (path.startsWith('/object/sign')) path = '/storage/v1' + path;

          const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
          const forwardedProto = req.headers.get('x-forwarded-proto') || 'http';
          const forwardedPort = req.headers.get('x-forwarded-port');
          let hostWithPort = forwardedHost;
          if (forwardedHost && forwardedPort && !forwardedHost.includes(':')) hostWithPort = `${forwardedHost}:${forwardedPort}`;
          if (hostWithPort) {
            finalSigned = `${forwardedProto}://${hostWithPort}` + path;
          } else {
            finalSigned = SUPABASE_URL.replace(/\/$/, '') + path;
          }
        } else {
          // If storage returned an absolute URL (may use internal host like 'kong'), parse and rebase it
          try {
            const parsed = new URL(String(signedAlt));
            // If parsed pathname uses internal '/object/sign', convert it to '/storage/v1/object/sign'
            let pathname = parsed.pathname;
            if (pathname.startsWith('/object/sign')) pathname = '/storage/v1' + pathname;

            const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
            const forwardedProto = req.headers.get('x-forwarded-proto') || 'http';
            let origin = SUPABASE_URL.replace(/\/$/, '');
            if (forwardedHost) {
              origin = `${forwardedProto}://${forwardedHost}`;
            }
            finalSigned = origin + pathname + parsed.search;
          } catch (e) {
            // If parsing fails, leave as-is
            finalSigned = signedAlt;
          }
        }
      } catch (e) {
        finalSigned = signedAlt;
      }
    }
    return jsonResponse({
      ok: true,
      signedUrl: finalSigned
    });
  } catch (err) {
    return jsonResponse({
      error: String(err?.message || err)
    }, 500);
  }
});
