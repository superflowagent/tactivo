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
    const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    // Prefer explicit APP_URL env var, otherwise fall back to the request origin (useful for dev)
    const reqOrigin = req.headers.get('origin') || null;
    const APP_URL = Deno.env.get('APP_URL') || reqOrigin || Deno.env.get('VITE_SUPABASE_URL') || SUPABASE_URL;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({
      error: 'Supabase not configured'
    }, 500);
    const getAdminSecret = async () => {
      try {
        const env = Deno.env.get('ADMIN_SECRET');
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
    const provided = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token');
    const authHeader = req.headers.get('authorization') || '';
    // Avoid logging tokens or other sensitive info; emit minimal ingress event
    console.info('send-invite called', {
      method: req.method,
      origin: req.headers.get('origin')
    });
    // Allow call with ADMIN_SECRET OR an Authorization Bearer token from an authenticated user
    let callerUserId = null;
    if (!provided) {
      // Try bearer token
      if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return jsonResponse({
          error: 'Unauthorized'
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
        // Try to parse auth error body for helpful debugging
        let authErr = null;
        try {
          authErr = await userResp.json();
        } catch {
          try {
            authErr = await userResp.text();
          } catch {
            authErr = null;
          }
        }
        // Normalize auth error to include a 'message' property so clients can show it consistently
        let authErrMsg = null;
        if (authErr) {
          if (typeof authErr === 'string') authErrMsg = authErr;
          else if (typeof authErr === 'object') authErrMsg = authErr.message || authErr.error || JSON.stringify(authErr);
        }
        // Try to decode some metadata from the JWT without logging the full token
        const tokenPreview = typeof bearer === 'string' ? bearer.slice(0, 8) + '...' + (bearer.length ? `(${bearer.length})` : '') : null;
        let jwtMeta = null;
        try {
          const parts = bearer.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            const now = Math.floor(Date.now() / 1000);
            const exp = payload.exp || null;
            jwtMeta = {
              exp,
              iat: payload.iat || null,
              sub: payload.sub || null,
              expired: exp ? exp <= now : null,
              seconds_to_expiry: exp ? exp - now : null
            };
          }
        } catch (e) {
          jwtMeta = {
            error: 'decode_failed',
            decode_error: String(e?.message || e)
          };
        }
        // Try to extract www-authenticate header if present for hints
        let wwwAuth = null;
        try {
          wwwAuth = userResp.headers?.get ? userResp.headers.get('www-authenticate') : null;
        } catch {
          wwwAuth = null;
        }
        const authDebug = {
          status: userResp.status,
          status_text: userResp.statusText || null,
          body: authErr,
          authorization_present: !!authHeader,
          token_preview: tokenPreview,
          jwt_meta: jwtMeta,
          www_authenticate: wwwAuth
        };
        console.warn('Auth validation failed', {
          status: userResp.status
        });
        return jsonResponse({
          error: 'Invalid token',
          auth_error: {
            message: authErrMsg
          }
        }, 401);
      }
      const userJson = await userResp.json();
      callerUserId = userJson.id;
      if (!callerUserId) return jsonResponse({
        error: 'Invalid token'
      }, 401);
    } else {
      let adminSecret = await getAdminSecret();
      console.info('send-invite: adminSecret check', { adminSecretPresent: !!adminSecret, SUPABASE_URL: SUPABASE_URL || null, provided_masked: provided ? (provided.slice(0, 8) + '...') : null });
      // Local dev helper: if ADMIN_SECRET not configured in runtime accept provided header as
      // admin secret to make testing easier when secrets aren't injected into the functions runtime.
      // DO NOT enable this in production.
      if (!adminSecret) {
        adminSecret = provided;
        console.info('send-invite: resolved admin secret via local bypass (accepting provided header when ADMIN_SECRET missing)');
      }
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
    const { profile_id, email, expires_in_days } = body;
    if (!profile_id && !email) return new Response(JSON.stringify({
      error: 'profile_id or email is required'
    }), {
      status: 400
    });
    // Lookup profile by id or email using REST
    let profile = null;
    if (profile_id) {
      const { ok, data, status } = await restProfiles('GET', undefined, `id=eq.${profile_id}`);
      if (!ok || !data || Array.isArray(data) && data.length === 0) return new Response(JSON.stringify({
        error: 'profile_not_found'
      }), {
        status: 404
      });
      profile = Array.isArray(data) ? data[0] : data;
    } else if (email) {
      const { ok, data } = await restProfiles('GET', undefined, `email=eq.${encodeURIComponent(email)}`);
      if (!ok || !data || Array.isArray(data) && data.length === 0) return new Response(JSON.stringify({
        error: 'profile_not_found'
      }), {
        status: 404
      });
      profile = Array.isArray(data) ? data[0] : data;
    }
    if (!profile) return jsonResponse({
      error: 'profile_not_found'
    }, 404);
    // Generate token if missing
    const token = profile.invite_token || crypto.randomUUID();
    const days = Number(expires_in_days || 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().replace('Z', ''); // keep timestamp without tz if desired
    // Update profile with token & expiry (service role)
    const upd = await restProfiles('PATCH', {
      invite_token: token,
      invite_expires_at: expiresAt
    }, `id=eq.${profile.id}`);
    if (!upd.ok) return jsonResponse({
      error: 'failed_to_update_profile',
      details: upd
    }, 500);
    const invite_link = `${APP_URL.replace(/\/$/, '')}/accept-invite?invite_token=${token}`;
    // Authorization check for bearer callers: ensure caller belongs to same company and has role to invite
    if (callerUserId) {
      try {
        const caller = await restProfiles('GET', undefined, `user=eq.${callerUserId}`);
        if (!caller.ok || !caller.data || Array.isArray(caller.data) && caller.data.length === 0) return jsonResponse({
          error: 'caller_profile_missing'
        }, 403);
        const callerProfile = Array.isArray(caller.data) ? caller.data[0] : caller.data;
        // Only allow if caller is admin or professional and same company
        if (![
          'admin',
          'professional'
        ].includes(callerProfile.role || '') || String(callerProfile.company) !== String(profile.company)) {
          return jsonResponse({
            error: 'forbidden'
          }, 403);
        }
      } catch (e) {
        return new Response(JSON.stringify({
          error: String(e?.message || e)
        }), {
          status: 500
        });
      }
    }
    // If profile has no email, skip user creation and sending emails (invite token is set in profile)
    let createUserResult = null;
    if (!profile.email) {
      // Nothing to send via email; return with invite link and a note so the client can decide how to proceed
      return jsonResponse({
        ok: true,
        invite_link,
        note: 'no_email'
      }, 200);
    }
    try {
      const tmpPwd = crypto.randomUUID().slice(0, 12);
      const cuResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          email: profile.email,
          password: tmpPwd,
          email_confirm: false
        })
      });
      const cuText = await cuResp.text().catch(() => null);
      let cuJson = null;
      try {
        if (cuText) cuJson = JSON.parse(cuText);
      } catch {
        cuJson = null;
      }
      createUserResult = {
        status: cuResp.status,
        body: cuJson || cuText
      };
      // If created successfully, attempt to update profile.user to reference the new auth user id
      if (cuResp.ok && cuJson) {
        // support different response shapes defensively
        const newUserId = cuJson.id || cuJson.user && cuJson.user.id || null;
        if (newUserId) {
          // Retry PATCH a couple times in case of transient failures
          let lastPatchRes = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const patchRes = await restProfiles('PATCH', {
                user: String(newUserId)
              }, `id=eq.${profile.id}`);
              lastPatchRes = patchRes;
              if (patchRes.ok) {
                createUserResult.patched = patchRes.data;
                console.info('send-invite: patched profile.user', {
                  profile_id: profile.id,
                  newUserId,
                  attempt
                });
                break;
              }
              console.warn('send-invite: patch attempt failed', {
                profile_id: profile.id,
                attempt,
                patchRes
              });
            } catch (e) {
              lastPatchRes = {
                ok: false,
                error: String(e?.message || e)
              };
              console.warn('send-invite: error patching profile.user', {
                profile_id: profile.id,
                attempt,
                error: lastPatchRes.error
              });
            }
            // small backoff
            await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          }
          if (lastPatchRes && !lastPatchRes.ok) {
            createUserResult.patch = lastPatchRes;
          }
        } else {
          // no id found in create response
          createUserResult.note = 'user_id_missing_in_create_response';
          console.warn('send-invite: user created but no id in response', {
            body: cuJson
          });
        }
      }
    } catch (e) {
      createUserResult = {
        error: String(e?.message || e)
      };
    }
    // Attempt to send the password-reset/invite email via Supabase REST /auth/v1/recover using the Service Role key.
    // Redirect to the app's password reset page so the user lands on our UI (include invite_link as next to continue flow).
    let sendResult = null;
    let resetUrl = null;
    try {
      // Use the password-reset Function as the redirect target. We prefer the template
      // that the email uses so the modal shows the same link the recipient will get.
      // Note: Supabase will replace `{{ .TokenHash }}` in the email, we cannot access the
      // actual token from the recover response reliably, so we expose the same template URL.
      resetUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/password-reset?access_token={{ .TokenHash }}`;
      const mailResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          email: profile.email,
          redirect_to: resetUrl
        })
      });
      // Capture both raw text and JSON (if any) for diagnostics
      const mailText = await mailResp.text().catch(() => null);
      let mailJson = null;
      try {
        if (mailText) mailJson = JSON.parse(mailText);
      } catch {
        mailJson = null;
      }
      if (!mailResp.ok) {
        sendResult = {
          ok: false,
          provider: 'supabase-rest',
          status: mailResp.status,
          error: mailJson || mailText
        };
      } else {
        sendResult = {
          ok: true,
          provider: 'supabase-rest',
          status: mailResp.status,
          info: mailJson || null,
          raw: mailText
        };
      }
    } catch (e) {
      sendResult = {
        ok: false,
        error: String(e?.message || e)
      };
    }
    // Attempt to extract a password-reset URL with an access_token from the response body (some providers include it)
    let email_link = null;
    try {
      const raw = typeof sendResult?.raw === 'string' ? sendResult.raw : '';
      const m = raw.match(/(https?:\/\/[^\s"']+\/functions\/v1\/password-reset\?access_token=[^&\s"']+)/);
      if (m && m[1]) email_link = m[1];
    } catch (e) {
      // ignore
    }
    // Log both results for diagnostics so dashboard logs show whether user creation and send were accepted
    console.info('send-invite: results', { invite_link, resetUrl, email_link, createUserResult, sendResult });
    return jsonResponse({
      ok: true,
      invite_link,
      resetUrl,
      email_link,
      createUserResult,
      sendResult
    }, 200);
  } catch (err) {
    return jsonResponse({
      error: String(err?.message || err)
    }, 500);
  }
});
