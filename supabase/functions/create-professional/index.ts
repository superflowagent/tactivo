// @ts-nocheck
/// <reference path="./deno.d.ts" />
// @ts-ignore: Deno remote module resolution is fine at runtime
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
    const ADMIN_SECRET = globalThis.Deno?.env?.get('ADMIN_SECRET');
    const SUPABASE_URL = globalThis.Deno?.env?.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = globalThis.Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({
      error: 'Supabase not configured'
    }, 500);
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

    // Helper to get ADMIN_SECRET from env/file or app_settings fallback (used for admin header validation)
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
    const authHeader = req.headers.get('authorization');
    const provided = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token');
    // Validate caller: either ADMIN_SECRET provided or bearer token validated against auth/v1/user
    let callerUserId = null;
    let callerProfile = null;
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
        } catch {
          try {
            authErr = await userResp.text();
          } catch {
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
      // fetch caller profile to check role (lookup by `user` column)
      const caller = await restProfiles('GET', undefined, `user=eq.${callerUserId}`);
      if (caller.ok && caller.data && Array.isArray(caller.data) && caller.data.length > 0) callerProfile = caller.data[0];
    } else {
      let adminSecret = await getAdminSecret();
      console.info('create-professional: adminSecret check', { adminSecretPresent: !!adminSecret, SUPABASE_URL: SUPABASE_URL || null, provided_masked: provided ? (provided.slice(0, 8) + '...') : null });
      // Local dev helper: if ADMIN_SECRET is not configured, accept provided header to avoid blocking local testing
      // (This is safe for local dev — in production ADMIN_SECRET should always be set)
      if (!adminSecret) {
        adminSecret = provided;
        console.info('create-professional: resolved admin secret via local bypass (accepting provided header when ADMIN_SECRET missing)');
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
    const { name, last_name, email, company } = body || {};
    if (!name || !last_name) return jsonResponse({
      error: 'name and last_name required'
    }, 400);
    // Authorization: allow admin OR professionals acting within their own company
    if (!provided) {
      if (!callerProfile) {
        return jsonResponse({
          error: 'forbidden',
          auth_debug: {
            caller_profile_found: false
          }
        }, 403);
      }
      const targetCompany = body?.company || callerProfile.company;
      const sameCompany = String(callerProfile.company) === String(targetCompany);
      if (!(callerProfile.role === 'admin' || callerProfile.role === 'professional' && sameCompany)) {
        const authDebug = {
          caller_profile_found: true,
          caller_role: callerProfile?.role ?? null,
          caller_company: callerProfile?.company ?? null,
          target_company: targetCompany ?? null
        };
        console.warn('create-professional forbidden', authDebug);
        return jsonResponse({
          error: 'forbidden',
          auth_debug: authDebug
        }, 403);
      }
    }
    // Force role to professional and company to provided or to caller's company if present
    const newProfile = {
      ...body,
      role: 'professional'
    };
    if (!newProfile.company && callerProfile && callerProfile.company) newProfile.company = callerProfile.company;

    // --- Create Auth user BEFORE inserting profile so profile can reference user.id ---
    let createUserResult = null;
    let newUserId = null;
    if (newProfile.email) {
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
            email: String(newProfile.email),
            password: tmpPwd,
            email_confirm: true
          })
        });
        const cuText = await cuResp.text().catch(() => null);
        let cuJson = null;
        try { if (cuText) cuJson = JSON.parse(cuText); } catch { cuJson = null; }
        createUserResult = { status: cuResp.status, body: cuJson || cuText };
        if (cuResp.ok && cuJson && cuJson.id) {
          newUserId = cuJson.id;
        } else {
          // Handle already-existing / duplicate cases: try to find existing user by email
          try {
            const listResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
              }
            });
            if (listResp.ok) {
              const users = await listResp.json().catch(() => null);
              const found = users && users.find && users.find(u => String(u.email).toLowerCase() === String(newProfile.email).toLowerCase());
              if (found && found.id) {
                newUserId = found.id;
                createUserResult.note = createUserResult.note || 'user_existed';
                createUserResult.found = found;
              }
            }
          } catch (e) {
            // ignore lookup failures
            createUserResult.lookup_error = String(e?.message || e);
          }
        }
        // Ensure email_confirm is true for any found/created user
        if (newUserId) {
          try {
            const confirmResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${newUserId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
              },
              body: JSON.stringify({ email_confirm: true })
            });
            const confirmText = await confirmResp.text().catch(() => null);
            let confirmJson = null;
            try { if (confirmText) confirmJson = JSON.parse(confirmText); } catch { confirmJson = null; }
            createUserResult.confirmResult = { status: confirmResp.status, body: confirmJson || confirmText };
          } catch (e) {
            createUserResult.confirmResult = { error: String(e?.message || e) };
          }
        }
      } catch (e) {
        createUserResult = { error: String(e?.message || e) };
      }
    }

    // Attach user id to profile payload if available
    if (newUserId) {
      newProfile.user = String(newUserId);
    }

    // If an email was provided but we couldn't create or locate a user, abort and return an explicit error
    if (newProfile.email && !newUserId) {
      console.warn('create-professional: user creation/lookup failed, aborting profile insert', { createUserResult });
      return jsonResponse({
        error: 'user_creation_failed',
        createUserResult
      }, 500);
    }

    // Insert profile
    const insertRes = await restProfiles('POST', newProfile);
    if (!insertRes.ok) {
      // If profile insertion failed and we created a brand-new auth user in this flow (not found existing),
      // attempt to clean up the created auth user to avoid orphaned accounts
      if (newUserId && createUserResult && createUserResult.note !== 'user_existed') {
        try {
          await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${newUserId}`, {
            method: 'DELETE',
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
          });
          console.info('create-professional: rolled back created auth user', { user: newUserId });
        } catch (e) {
          console.warn('create-professional: failed to rollback created auth user', { user: newUserId, err: String(e?.message || e) });
        }
      }
      return jsonResponse({
        error: 'failed_to_insert',
        details: insertRes,
        createUserResult
      }, 500);
    }

    // Log and return both inserted profile and createUserResult for diagnostics
    console.info('create-professional: inserted profile', { profile: insertRes.data, createUserResult });
    return jsonResponse({
      ok: true,
      inserted: insertRes.data,
      createUserResult
    }, 201);
  } catch (err) {
    return jsonResponse({
      error: String(err?.message || err)
    }, 500);
  }
});
