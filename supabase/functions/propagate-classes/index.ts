// @ts-nocheck
/// <reference path="./deno.d.ts" />
// @ts-ignore: Deno remote module resolution is fine at runtime
import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';

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

    // Helper to call Supabase REST using Service Role key
    const rest = async (resource: string, method: string, body?: any, query?: string) => {
      const url = `${SUPABASE_URL}/rest/v1/${resource}${query ? `?${query}` : ''}`;
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
    } else {
      if (!ADMIN_SECRET) return jsonResponse({ error: 'ADMIN_SECRET not configured' }, 500);
      if (provided !== ADMIN_SECRET) return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    const body = await req.json().catch(() => ({}));
    const { company, month, year, templates } = body || {};
    if (!company) return jsonResponse({ error: 'company is required' }, 400);
    if (!month || !year) return jsonResponse({ error: 'month and year are required' }, 400);
    if (!templates || !Array.isArray(templates) || templates.length === 0)
      return jsonResponse({ error: 'templates array is required' }, 400);

    // Normalize templates and generate events for the given month/year
    const daysInMonth = new Date(year, month, 0).getDate();

    const formatDateWithOffset = (d: Date) => {
      const pad = (n) => n.toString().padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      const seconds = pad(d.getSeconds());
      const tzOffsetMin = -d.getTimezoneOffset();
      const tzSign = tzOffsetMin >= 0 ? '+' : '-';
      const absOffsetMin = Math.abs(tzOffsetMin);
      const tzHours = pad(Math.floor(absOffsetMin / 60));
      const tzMinutes = pad(absOffsetMin % 60);
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}:${tzMinutes}`;
    };

    const eventsToCreate = [];

    for (const t of templates) {
      // Determine day of week (0=Sunday..6=Saturday)
      let templateDay = null;
      if (typeof t.day === 'number') {
        templateDay = t.day;
        // convert 7 -> 0 if some templates store Sunday as 7
        if (templateDay === 7) templateDay = 0;
      } else if (t.datetime) {
        templateDay = new Date(t.datetime).getDay();
      }
      if (typeof templateDay !== 'number') continue; // skip malformed template

      // Determine hour/minute
      let hours = 10;
      let minutes = 0;
      if (typeof t.time === 'string' && t.time.includes(':')) {
        const [h, m] = t.time.split(':').map((s) => parseInt(s, 10) || 0);
        hours = h;
        minutes = m;
      } else if (t.datetime) {
        const dt = new Date(t.datetime);
        hours = dt.getHours();
        minutes = dt.getMinutes();
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        if (currentDate.getDay() === templateDay) {
          currentDate.setHours(hours, minutes, 0, 0);
          eventsToCreate.push({
            type: 'class',
            datetime: formatDateWithOffset(currentDate),
            duration: t.duration || 60,
            // If there are no clients specified, set client to NULL so the DB trigger
            // can skip processing without ambiguity (empty arrays can be misinterpreted
            // by some clients or middle layers).
            client: Array.isArray(t.client) ? (t.client.length ? t.client : null) : t.client ? [t.client] : null,
            professional: Array.isArray(t.professional)
              ? (t.professional.length ? t.professional : null)
              : t.professional
                ? [t.professional]
                : null,
            company,
            notes: t.notes ? t.notes : null,
          });
        }
      }
    }

    // Insert events in bulk
    if (eventsToCreate.length === 0) return jsonResponse({ ok: true, inserted: 0 }, 200);

    // Precompute client counts from the events we will create for auditing/debugging
    // (do not use these to update profiles here — the DB trigger handles credits).
    const clientCounts: Record<string, number> = {};
    for (const ev of eventsToCreate) {
      const clients = Array.isArray(ev.client) ? ev.client : ev.client ? [ev.client] : [];
      for (const c of clients) {
        clientCounts[c] = (clientCounts[c] || 0) + 1;
      }
    }

    const insertRes = await rest('events', 'POST', eventsToCreate);
    if (!insertRes.ok)
      return jsonResponse({ error: 'failed_to_insert_events', details: insertRes }, 500);

    const inserted = Array.isArray(insertRes.data) ? insertRes.data : [insertRes.data];

    // NOTE: class credit adjustments are handled by the DB trigger
    // `trg_adjust_class_credits` on `public.events`. Do not apply
    // additional updates here to avoid double-deduction.

    return jsonResponse({ ok: true, inserted: inserted.length, client_counts: clientCounts }, 200);
  } catch (err: any) {
    return jsonResponse({ error: String(err?.message || err) }, 500);
  }
});
