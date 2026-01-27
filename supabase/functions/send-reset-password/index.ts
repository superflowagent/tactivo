import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';

// allow using the Deno global without strict type errors in this file
declare const Deno: any;

serve(async (req: Request) => {
    const origin = req.headers.get('origin') || '*';
    const corsHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Secret, X-Admin-Token',
        'Access-Control-Max-Age': '3600',
        'Vary': 'Origin'
    };

    if (origin !== '*') corsHeaders['Access-Control-Allow-Credentials'] = 'true';

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    const jsonResponse = (body: any, status = 200): Response => {
        const h: Record<string, string> = { 'Content-Type': 'application/json', ...corsHeaders };
        return new Response(JSON.stringify(body), { status, headers: h });
    };

    try {
        const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET');
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const reqOrigin = req.headers.get('origin') || null;
        const APP_URL = Deno.env.get('APP_URL') || reqOrigin || Deno.env.get('VITE_SUPABASE_URL') || SUPABASE_URL;

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({ error: 'Supabase not configured' }, 500);

        const getAdminSecret = async (): Promise<string | null> => {
            try {
                const env = Deno.env.get('ADMIN_SECRET');
                if (env) return env;
                try {
                    const txt = await (Deno as any).readTextFile('./.local_admin_secret');
                    if (txt) return txt.trim();
                } catch (e: any) {
                    // ignore
                }

                const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/app_settings?select=value&key=eq.ADMIN_SECRET`;
                const res = await fetch(url, { headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
                if (!res.ok) return null;
                const json = await res.json().catch(() => null);
                if (Array.isArray(json) && json.length) return json[0].value || null;
                return null;
            } catch (e: any) {
                return null;
            }
        };

        const restProfiles = async (method: string, body?: any, query?: string): Promise<{ ok: boolean; status: number; data: any }> => {
            const url = `${SUPABASE_URL}/rest/v1/profiles${query ? `?${query}` : ''}`;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
            const text = await res.text();
            let data: any = null;
            try { data = JSON.parse(text); } catch { data = text; }
            return { ok: res.ok, status: res.status, data };
        };

        const provided = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token');
        const authHeader = req.headers.get('authorization') || '';
        console.info('send-reset-password called', { method: req.method, origin: req.headers.get('origin') });

        let callerUserId: string | null = null;

        if (!provided) {
            if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
                return jsonResponse({ error: 'Unauthorized' }, 401);
            }

            const bearer = authHeader.substring(7);
            const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${bearer}` } });

            if (!userResp.ok) {
                let authErr: any = null;
                try { authErr = await userResp.json(); } catch { try { authErr = await userResp.text(); } catch { authErr = null; } }
                let authErrMsg = null;
                if (authErr) authErrMsg = typeof authErr === 'string' ? authErr : (authErr.message || authErr.error || JSON.stringify(authErr));
                console.warn('Auth validation failed', { status: userResp.status });
                return jsonResponse({ error: 'Invalid token', auth_error: { message: authErrMsg } }, 401);
            }

            const userJson: any = await userResp.json();
            callerUserId = userJson.id || null;
            if (!callerUserId) return jsonResponse({ error: 'Invalid token' }, 401);
        } else {
            const adminSecret = await getAdminSecret();
            if (!adminSecret) return jsonResponse({ error: 'ADMIN_SECRET not configured' }, 500);
            if (provided !== adminSecret) return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

        const body = await req.json().catch(() => ({}));
        const { profile_id, email, expires_in_days } = body as any;
        if (!profile_id && !email) return jsonResponse({ error: 'profile_id or email is required' }, 400);

        let profile: any = null;
        if (profile_id) {
            const { ok, data } = await restProfiles('GET', undefined, `id=eq.${profile_id}`);
            if (!ok || !data || (Array.isArray(data) && data.length === 0)) return jsonResponse({ error: 'profile_not_found' }, 404);
            profile = Array.isArray(data) ? data[0] : data;
        } else if (email) {
            const { ok, data } = await restProfiles('GET', undefined, `email=eq.${encodeURIComponent(email)}`);
            if (!ok || !data || (Array.isArray(data) && data.length === 0)) return jsonResponse({ error: 'profile_not_found' }, 404);
            profile = Array.isArray(data) ? data[0] : data;
        }

        if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404);

        const token = profile.invite_token || crypto.randomUUID();
        const days = Number(expires_in_days || 7);
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().replace('Z', '');
        const upd = await restProfiles('PATCH', { invite_token: token, invite_expires_at: expiresAt }, `id=eq.${profile.id}`);
        if (!upd.ok) return jsonResponse({ error: 'failed_to_update_profile', details: upd }, 500);

        const invite_link = `${APP_URL.replace(/\/$/, '')}/accept-invite?invite_token=${token}`;

        // Authorization checks
        if (callerUserId) {
            try {
                const caller = await restProfiles('GET', undefined, `user=eq.${callerUserId}`);
                if (!caller.ok || !caller.data || (Array.isArray(caller.data) && caller.data.length === 0)) return jsonResponse({ error: 'caller_profile_missing' }, 403);
                const callerProfile: any = Array.isArray(caller.data) ? caller.data[0] : caller.data;
                if (!['admin', 'professional'].includes(callerProfile.role || '') || String(callerProfile.company) !== String(profile.company)) return jsonResponse({ error: 'forbidden' }, 403);
            } catch (e: any) {
                return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 });
            }
        }

        // If profile has no email, skip
        let createUserResult: any = null;
        if (!profile.email) return jsonResponse({ ok: true, invite_link, note: 'no_email' }, 200);

        // If profile already linked to user, do not recreate
        if (profile.user) {
            createUserResult = { note: 'user_already_linked', user: profile.user };
        } else {
            try {
                const tmpPwd = crypto.randomUUID().slice(0, 12);
                const cuResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify({ email: profile.email, password: tmpPwd, email_confirm: false }) });
                const cuText = await cuResp.text().catch(() => null);
                let cuJson: any = null;
                try { if (cuText) cuJson = JSON.parse(cuText); } catch { cuJson = null; }
                createUserResult = { status: cuResp.status, body: cuJson || cuText };
                if (cuResp.ok && cuJson) {
                    const newUserId = cuJson.id || (cuJson.user && cuJson.user.id) || null;
                    if (newUserId) {
                        if (!profile.user) {
                            let lastPatchRes: any = null;
                            for (let attempt = 0; attempt < 3; attempt++) {
                                try {
                                    const patchRes = await restProfiles('PATCH', { user: String(newUserId) }, `id=eq.${profile.id}`);
                                    lastPatchRes = patchRes;
                                    if (patchRes.ok) {
                                        createUserResult.patched = patchRes.data;
                                        console.info('send-reset-password: patched profile.user', { profile_id: profile.id, newUserId, attempt });
                                        break;
                                    }
                                    console.warn('send-reset-password: patch attempt failed', { profile_id: profile.id, attempt, patchRes });
                                } catch (e: any) {
                                    lastPatchRes = { ok: false, error: String(e?.message || e) };
                                    console.warn('send-reset-password: error patching profile.user', { profile_id: profile.id, attempt, error: lastPatchRes.error });
                                }
                                await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
                            }
                            if (lastPatchRes && !lastPatchRes.ok) createUserResult.patch = lastPatchRes;
                        } else {
                            createUserResult.note = 'profile_user_already_set';
                        }
                    } else {
                        createUserResult.note = 'user_id_missing_in_create_response';
                        console.warn('send-reset-password: user created but no id in response', { body: cuJson });
                    }
                }
            } catch (e: any) {
                createUserResult = { error: String(e?.message || e) };
            }
        }

        // Send recover email via auth/v1/recover
        let sendResult: any = null;
        let resetUrl: string | null = null;
        try {
            resetUrl = SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/password-reset?access_token={{ .TokenHash }}';
            const mailResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/recover`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify({ email: profile.email, redirect_to: resetUrl }) });
            const mailText = await mailResp.text().catch(() => null);
            let mailJson: any = null;
            try { if (mailText) mailJson = JSON.parse(mailText); } catch { mailJson = null; }
            if (!mailResp.ok) sendResult = { ok: false, provider: 'supabase-rest', status: mailResp.status, error: mailJson || mailText };
            else sendResult = { ok: true, provider: 'supabase-rest', status: mailResp.status, info: mailJson || null, raw: mailText };
        } catch (e: any) {
            sendResult = { ok: false, error: String(e?.message || e) };
        }

        // attempt to extract URL without using regex (safer for parsers)
        let email_link: string | null = null;
        try {
            const raw = typeof sendResult?.raw === 'string' ? sendResult.raw : '';
            const needle = '/functions/v1/password-reset?access_token=';
            const pos = raw.indexOf(needle);
            if (pos !== -1) {
                const protoPos = raw.lastIndexOf('http', pos);
                if (protoPos !== -1) {
                    // find end (space or quote)
                    let endPos = raw.indexOf(' ', pos);
                    const q1 = raw.indexOf('"', pos);
                    const q2 = raw.indexOf("'", pos);
                    if (q1 !== -1 && (endPos === -1 || q1 < endPos)) endPos = q1;
                    if (q2 !== -1 && (endPos === -1 || q2 < endPos)) endPos = q2;
                    if (endPos === -1) endPos = raw.length;
                    email_link = raw.substring(protoPos, endPos);
                }
            }
        } catch (e: any) {
            // ignore
        }

        console.info('send-reset-password: results', { invite_link, resetUrl, email_link, createUserResult, sendResult });

        return jsonResponse({ ok: true, invite_link, resetUrl, email_link, createUserResult, sendResult }, 200);
    } catch (err: any) {
        return jsonResponse({ error: String(err?.message || err) }, 500);
    }
});