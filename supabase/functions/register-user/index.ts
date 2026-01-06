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
    const SUPABASE_URL = (globalThis as any).Deno?.env?.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any).Deno?.env?.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      return jsonResponse({ error: 'Supabase not configured' }, 500);

    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    const body = await req.json().catch(() => ({}));
    const { email, centro, name, last_name, movil } = body || {};
    if (!email || !centro || !name || !last_name)
      return jsonResponse({ error: 'email, centro, name and last_name are required' }, 400);

    // Helpers to call REST endpoints with service role key
    const restCompanies = async (method: string, body?: any, query?: string) => {
      const url = `${SUPABASE_URL}/rest/v1/companies${query ? `?${query}` : ''}`;
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

    // Normalize centro -> domain
    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    const baseDomain = normalize(centro);
    if (!baseDomain) return jsonResponse({ error: 'invalid_centro_name' }, 400);

    // Ensure unique domain
    let domain = baseDomain;
    let suffix = 0;
    while (true) {
      const check = await restCompanies('GET', undefined, `domain=eq.${encodeURIComponent(domain)}`);
      if (!check.ok) return jsonResponse({ error: 'failed_check_domain', details: check }, 500);
      if (!check.data || (Array.isArray(check.data) && check.data.length === 0)) break;
      suffix += 1;
      domain = `${baseDomain}-${suffix}`;
    }

    // Create company
    const companyRes = await restCompanies('POST', { name: centro, domain });
    if (!companyRes.ok) return jsonResponse({ error: 'failed_to_create_company', details: companyRes }, 500);
    const company = Array.isArray(companyRes.data) ? companyRes.data[0] : companyRes.data;

    // Create auth user (admin endpoint)
    let createUserResult: any = null;
    try {
      const tmpPwd = crypto.randomUUID().slice(0, 12);
      const cuResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ email, password: tmpPwd, email_confirm: false }),
      });
      const cuText = await cuResp.text().catch(() => null);
      let cuJson: any = null;
      try {
        if (cuText) cuJson = JSON.parse(cuText);
      } catch {
        cuJson = null;
      }
      createUserResult = { status: cuResp.status, body: cuJson || cuText };
      if (!(cuResp.ok && cuJson && cuJson.id)) {
        // User not created, but we continue (profile can be created without user)
        createUserResult.note = 'user_not_created';
      }
      // store id for profile if available
      const newUserId = cuJson && cuJson.id ? cuJson.id : null;

      // Create profile with role professional
      const profilePayload: any = {
        name,
        last_name,
        email,
        phone: movil || null,
        role: 'professional',
        company: company?.id ?? null,
      };
      if (newUserId) profilePayload.user = newUserId;

      const profileRes = await restProfiles('POST', profilePayload);
      if (!profileRes.ok) return jsonResponse({ error: 'failed_to_create_profile', details: profileRes }, 500);
      const profile = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data;

      // Attempt to send password reset / recover email
      let sendResult: any = null;
      try {
        const resetUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/password-reset?access_token={{ .TokenHash }}`;
        const mailResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/recover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ email, redirect_to: resetUrl }),
        });
        const mailText = await mailResp.text().catch(() => null);
        let mailJson: any = null;
        try {
          if (mailText) mailJson = JSON.parse(mailText);
        } catch {
          mailJson = null;
        }
        if (!mailResp.ok) {
          sendResult = { ok: false, status: mailResp.status, error: mailJson || mailText };
        } else {
          sendResult = { ok: true, status: mailResp.status, info: mailJson || null, raw: mailText };
        }
      } catch (e: any) {
        sendResult = { ok: false, error: String(e?.message || e) };
      }

      return jsonResponse({ ok: true, company, profile, createUserResult, sendResult }, 201);
    } catch (e: any) {
      return jsonResponse({ error: String(e?.message || e) }, 500);
    }
  } catch (err: any) {
    return jsonResponse({ error: String(err?.message || err) }, 500);
  }
});
