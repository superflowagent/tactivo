import { serve } from 'https://deno.land/std@0.178.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';
serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const APP_URL = Deno.env.get('APP_URL') || (req.headers.get('origin') ?? '');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({
        error: 'Supabase not configured'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const url = new URL(req.url);
    const tokenHash = url.searchParams.get('access_token') || url.searchParams.get('token');
    const next = url.searchParams.get('next') || '/auth/password-reset';
    if (!tokenHash) {
      // Missing token: redirect to client error page
      const errUrl = `${APP_URL.replace(/\/$/, '')}/auth/password-reset?error=missing_token`;
      return Response.redirect(errUrl, 302);
    }
    // Create server-side Supabase client using Service Role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    // Try verifyOtp (exchange TokenHash) as recovery type
    let data = null;
    let error = null;
    try {
      const res = await supabase.auth.verifyOtp({
        token: tokenHash,
        type: 'recovery'
      });
      data = res.data;
      error = res.error;
    } catch (e) {
      error = {
        message: String(e)
      };
    }
    // If first attempt failed, try token_hash param (some versions expect this key)
    if (error) {
      try {
        const res2 = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery'
        });
        data = res2.data;
        error = res2.error;
      } catch (e) {
        console.warn('verifyOtp(token_hash) threw', String(e));
        error = {
          message: String(e)
        };
      }
    }
    // If still failing, and an email param was passed in the link, try including email
    const providedEmail = url.searchParams.get('email');
    if (error && providedEmail) {
      try {
        const res3 = await supabase.auth.verifyOtp({
          email: providedEmail,
          token: tokenHash,
          type: 'recovery'
        });
        data = res3.data;
        error = res3.error;
      } catch (e) {
        console.warn('verifyOtp(email+token) threw', String(e));
        error = {
          message: String(e)
        };
      }
    }
    if (error) {
      // On failure, redirect to client with an error query so UI shows message (include JSON for debugging)
      const errPayload = encodeURIComponent(JSON.stringify({
        message: error.message || 'verify_failed',
        details: error
      }));
      const errUrl = `${APP_URL.replace(/\/$/, '')}/auth/password-reset?error=${errPayload}`;
      return Response.redirect(errUrl, 302);
    }
    // The response shape may vary; try to extract session tokens
    // Common successful response contains data.session or data.access_token
    let accessToken = null;
    let refreshToken = null;
    try {
      if (data?.session?.access_token) {
        accessToken = data.session.access_token;
        refreshToken = data.session.refresh_token;
      } else if (data?.access_token) {
        accessToken = data.access_token;
        refreshToken = data.refresh_token || null;
      }
    } catch {
      // ignore
    }
    // If we have real tokens, redirect using fragment (safer: fragments aren't sent to server logs)
    if (accessToken) {
      const fragParts = [];
      fragParts.push(`access_token=${encodeURIComponent(accessToken)}`);
      if (refreshToken) fragParts.push(`refresh_token=${encodeURIComponent(refreshToken)}`);
      // include an indicator the flow came from server exchange
      fragParts.push('from=server');
      const final = `${APP_URL.replace(/\/$/, '')}${next}#${fragParts.join('&')}`;
      return Response.redirect(final, 302);
    }
    // Fallback: if no full session returned, pass the tokenHash to client as query param
    // Client will attempt to handle token query (we already added support for ?token=...)
    const fallback = `${APP_URL.replace(/\/$/, '')}${next}?token=${encodeURIComponent(tokenHash)}`;
    return Response.redirect(fallback, 302);
  } catch (e) {
    try {
      console.warn('password-reset exchange error', String(e?.message || e));
    } catch {
      /* ignore */
    }
    const APP_URL = Deno.env.get('APP_URL') || (req.headers.get('origin') ?? '');
    const fail = `${APP_URL.replace(/\/$/, '')}/auth/password-reset?error=server_error`;
    return Response.redirect(fail, 302);
  }
});
