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
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    const jsonResponse = (body, status = 200) => {
        const h = { 'Content-Type': 'application/json', ...corsHeaders };
        return new Response(JSON.stringify(body), { status, headers: h });
    };
    try {
        const SUPABASE_URL = globalThis.Deno?.env?.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = globalThis.Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({ error: 'Supabase not configured' }, 500);

        const getAdminSecret = async () => {
            try {
                const env = globalThis.Deno?.env?.get('ADMIN_SECRET');
                if (env) return env;
                try {
                    const txt = await (Deno as any).readTextFile('./.local_admin_secret');
                    if (txt) return txt.trim();
                } catch (e) { }
                const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/app_settings?select=value&key=eq.ADMIN_SECRET`;
                const res = await fetch(url, { headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
                if (!res.ok) return null;
                const json = await res.json().catch(() => null);
                if (Array.isArray(json) && json.length) return json[0].value || null;
                return null;
            } catch (e) { return null; }
        };

        const restProfiles = async (method, body, query) => {
            const url = `${SUPABASE_URL}/rest/v1/profiles${query ? `?${query}` : ''}`;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
            const text = await res.text();
            let data = null;
            try { data = JSON.parse(text); } catch { data = text; }
            return { ok: res.ok, status: res.status, data };
        };

        const restCompanies = async (method, body, query) => {
            const url = `${SUPABASE_URL}/rest/v1/companies${query ? `?${query}` : ''}`;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
            const text = await res.text();
            let data = null;
            try { data = JSON.parse(text); } catch { data = text; }
            return { ok: res.ok, status: res.status, data };
        };

        // Authorization: allow ADMIN_SECRET OR a valid bearer token OR allow public registration path
        const authHeader = req.headers.get('authorization');
        const provided = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token');
        let callerUserId = null;
        let callerProfile = null;
        if (!provided) {
            // try bearer token if present
            if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
                const bearer = authHeader.substring(7);
                const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${bearer}` } });
                if (userResp.ok) {
                    const userJson = await userResp.json();
                    callerUserId = userJson.id;
                    try {
                        const caller = await restProfiles('GET', undefined, `user=eq.${callerUserId}`);
                        if (caller.ok && caller.data && Array.isArray(caller.data) && caller.data.length > 0) callerProfile = caller.data[0];
                    } catch (e) { }
                }
            }
        } else {
            const adminSecret = await getAdminSecret();
            if (!adminSecret) return jsonResponse({ error: 'ADMIN_SECRET not configured' }, 500);
            if (provided !== adminSecret) return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
        const body = await req.json().catch(() => ({}));

        const {
            name,
            last_name,
            email,
            phone,
            role,
            company,
            company_name,
            company_domain,
            create_company,
            sendInvite = true,
            dni
        } = body || {};

        if (!role || !['client', 'professional'].includes(role)) return jsonResponse({ error: 'role must be client or professional' }, 400);
        if (!name || !last_name) return jsonResponse({ error: 'name and last_name required' }, 400);

        // If caller is a bearer user and not admin or professional for target company, enforce checks
        if (callerUserId && callerProfile) {
            if (!(callerProfile.role === 'admin' || callerProfile.role === 'professional')) return jsonResponse({ error: 'forbidden_role' }, 403);
            // if company provided, verify same company or admin
            if (company && String(callerProfile.company) !== String(company) && callerProfile.role !== 'admin') return jsonResponse({ error: 'forbidden_company' }, 403);
        }

        // If public registration (no provided/admin and no callerUser), only allow professional register flows that create company
        const publicRegister = !provided && !callerUserId;
        if (publicRegister) {
            if (!(role === 'professional' && (create_company === true || (company_name && company_name.trim())))) {
                return jsonResponse({ error: 'forbidden_public_registration' }, 403);
            }
        }

        // Optional: create company if needed
        let finalCompanyId = company || null;
        if (role === 'professional' && (create_company === true || (!finalCompanyId && company_name))) {
            // Normalize domain if not provided
            const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
            let domain = company_domain ? normalize(company_domain) : (company_name ? normalize(company_name) : null);
            if (!domain) return jsonResponse({ error: 'company_domain_required' }, 400);
            // ensure unique domain
            let suffix = 0;
            let base = domain;
            while (true) {
                const check = await restCompanies('GET', undefined, `domain=eq.${encodeURIComponent(domain)}`);
                if (!check.ok) return jsonResponse({ error: 'failed_check_company_domain', details: check }, 500);
                if (!check.data || (Array.isArray(check.data) && check.data.length === 0)) break;
                suffix += 1;
                domain = `${base}-${suffix}`;
            }
            const createComp = await restCompanies('POST', { name: company_name, domain });
            if (!createComp.ok) return jsonResponse({ error: 'failed_to_create_company', details: createComp }, 500);
            finalCompanyId = Array.isArray(createComp.data) ? createComp.data[0].id : createComp.data.id || (createComp.data && createComp.data[0] && createComp.data[0].id) || null;
        }

        // Create auth user (idempotent: if already exists, find existing)
        let createUserResult = null;
        let newUserId = null;
        if (email) {
            try {
                const tmpPwd = crypto.randomUUID().slice(0, 12);
                const cuResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
                    body: JSON.stringify({ email, password: tmpPwd, email_confirm: true })
                });
                const cuText = await cuResp.text().catch(() => null);
                let cuJson = null;
                try { if (cuText) cuJson = JSON.parse(cuText); } catch { cuJson = null; }
                createUserResult = { status: cuResp.status, body: cuJson || cuText };
                if (cuResp.ok && cuJson && cuJson.id) newUserId = cuJson.id;
                else {
                    // find existing user by email
                    try {
                        const listResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
                        if (listResp.ok) {
                            const users = await listResp.json().catch(() => null);
                            const found = users && users.find && users.find(u => String(u.email).toLowerCase() === String(email).toLowerCase());
                            if (found && found.id) { newUserId = found.id; createUserResult.note = createUserResult.note || 'user_existed'; createUserResult.found = found; }
                        }
                    } catch (e) { createUserResult.lookup_error = String(e?.message || e); }
                }
            } catch (e) { createUserResult = { error: String(e?.message || e) }; }
        }

        if (!newUserId && email) {
            console.warn('create-account: user creation/lookup failed', { createUserResult });
            return jsonResponse({ error: 'user_creation_failed', createUserResult }, 500);
        }

        // Create profile
        const profilePayload: any = { name, last_name, email: email || null, phone: phone || null, role, company: finalCompanyId || null };
        // Include DNI when provided (clients may supply DNI at creation time)
        if (typeof dni !== 'undefined' && dni !== null) profilePayload.dni = dni;
        if (newUserId) profilePayload.user = newUserId;
        const profileRes = await restProfiles('POST', profilePayload);
        if (!profileRes.ok) {
            // rollback created user if we created it now and it wasn't pre-existing
            if (newUserId && createUserResult && createUserResult.note !== 'user_existed') {
                try {
                    await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${newUserId}`, { method: 'DELETE', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
                } catch (e) { console.warn('create-account: failed to rollback user', { err: String(e?.message || e) }); }
            }
            return jsonResponse({ error: 'failed_to_create_profile', details: profileRes, createUserResult }, 500);
        }
        const inserted = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data;

        // Optionally send reset-password (via send-reset-password or internal fallback using service role key)
        let sendResult = null;
        if (sendInvite && inserted && (inserted.id || email)) {
            try {
                const adminSecretVal = await getAdminSecret();
                if (adminSecretVal) {
                    const headers: any = { 'Content-Type': 'application/json', 'x-admin-secret': adminSecretVal };
                    const fnResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/send-reset-password`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ profile_id: inserted.id })
                    });
                    const fnJson = await fnResp.json().catch(() => null);
                    sendResult = { ok: fnResp.ok, status: fnResp.status, json: fnJson };
                } else {
                    // Fallback: generate invite_token locally, patch profile and call auth/v1/recover via service role
                    if (!inserted.email && !email) {
                        // nothing to send
                        sendResult = { ok: true, note: 'no_email' };
                    } else {
                        const token = crypto.randomUUID();
                        const days = 7;
                        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().replace('Z', '');
                        const up = await restProfiles('PATCH', { invite_token: token, invite_expires_at: expiresAt }, `id=eq.${inserted.id}`);
                        if (!up.ok) {
                            sendResult = { ok: false, error: 'failed_to_update_profile_for_invite', details: up };
                        } else {
                            const APP_URL = globalThis.Deno?.env?.get('APP_URL') || origin || globalThis.Deno?.env?.get('VITE_SUPABASE_URL') || SUPABASE_URL;
                            const resetUrl = SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/password-reset?access_token={{ .TokenHash }}';
                            try {
                                const mailResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/recover`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify({ email: inserted.email || email, redirect_to: resetUrl }) });
                                const mailText = await mailResp.text().catch(() => null);
                                let mailJson = null;
                                try { if (mailText) mailJson = JSON.parse(mailText); } catch { mailJson = null; }
                                if (!mailResp.ok) sendResult = { ok: false, provider: 'supabase-rest', status: mailResp.status, error: mailJson || mailText };
                                else sendResult = { ok: true, provider: 'supabase-rest', status: mailResp.status, info: mailJson || null, raw: mailText, invite_link: `${APP_URL.replace(/\/$/, '')}/accept-invite?invite_token=${token}` };
                            } catch (e) {
                                sendResult = { ok: false, error: String(e?.message || e) };
                            }
                        }
                    }
                }
            } catch (e) { sendResult = { ok: false, error: String(e?.message || e) }; }
        }

        return jsonResponse({ ok: true, profile: inserted, user: newUserId, createUserResult, sendResult }, 201);
    } catch (err) {
        return jsonResponse({ error: String(err?.message || err) }, 500);
    }
});
