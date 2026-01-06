// @ts-nocheck
/// <reference path="./deno.d.ts" />
// @ts-ignore: Deno remote module resolution is fine at runtime
import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';

// local fallback for the type checker
declare const Deno: any;

serve(async (req: any) => {
    const origin = req.headers.get('origin') || '*';
    const corsHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Secret, X-Admin-Token',
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
        const ADMIN_SECRET = (globalThis as any).Deno?.env?.get('ADMIN_SECRET');
        const SUPABASE_URL = (globalThis as any).Deno?.env?.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any).Deno?.env?.get(
            'SUPABASE_SERVICE_ROLE_KEY'
        );

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
        const provided = req.headers.get('x-admin-secret') || req.headers.get('x-admin-token');

        // Validate caller: either ADMIN_SECRET provided or bearer token validated against auth/v1/user
        let callerUserId: string | null = null;
        let callerProfile: any = null;
        if (!provided) {
            if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
                return jsonResponse({ error: 'Missing authorization header' }, 401);
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
                    try {
                        authErr = await userResp.text();
                    } catch {
                        authErr = null;
                    }
                }
                return jsonResponse({ error: 'Invalid token', auth_error: authErr }, 401);
            }
            const userJson = await userResp.json();
            callerUserId = userJson.id;
            if (!callerUserId) return jsonResponse({ error: 'Invalid token' }, 401);
            // fetch caller profile to check role (lookup by `user` column)
            const caller = await restProfiles('GET', undefined, `user=eq.${callerUserId}`);
            if (caller.ok && caller.data && Array.isArray(caller.data) && caller.data.length > 0)
                callerProfile = caller.data[0];
        } else {
            if (!ADMIN_SECRET) return jsonResponse({ error: 'ADMIN_SECRET not configured' }, 500);
            if (provided !== ADMIN_SECRET) return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

        const body = await req.json().catch(() => ({}));
        const { name, last_name, email, company } = body || {};
        if (!name || !last_name) return jsonResponse({ error: 'name and last_name required' }, 400);

        // Authorization: allow admin OR professionals acting within their own company
        if (!provided) {
            if (!callerProfile) {
                return jsonResponse({ error: 'forbidden', auth_debug: { caller_profile_found: false } }, 403);
            }

            const targetCompany = body?.company || callerProfile.company;
            const sameCompany = String(callerProfile.company) === String(targetCompany);

            if (!(callerProfile.role === 'admin' || (callerProfile.role === 'professional' && sameCompany))) {
                const authDebug: any = {
                    caller_profile_found: true,
                    caller_role: callerProfile?.role ?? null,
                    caller_company: callerProfile?.company ?? null,
                    target_company: targetCompany ?? null,
                };
                console.warn('create-professional forbidden', authDebug);
                return jsonResponse({ error: 'forbidden', auth_debug: authDebug }, 403);
            }
        }

        // Force role to professional and company to provided or to caller's company if present
        const newProfile: any = { ...body, role: 'professional' };
        if (!newProfile.company && callerProfile && callerProfile.company)
            newProfile.company = callerProfile.company;

        const insertRes = await restProfiles('POST', newProfile);
        if (!insertRes.ok) return jsonResponse({ error: 'failed_to_insert', details: insertRes }, 500);

        return jsonResponse({ ok: true, inserted: insertRes.data }, 201);
    } catch (err: any) {
        return jsonResponse({ error: String(err?.message || err) }, 500);
    }
});
