import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Serverless endpoint to create an auth user + profile and send a reset link.
// Security: requires ADMIN_SECRET header to match process.env.ADMIN_SECRET

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret)
    return res.status(500).json({ error: 'Server not configured (ADMIN_SECRET missing)' });

  const provided = req.headers['x-admin-secret'] || req.headers['x-admin-token'];
  if (!provided || provided !== adminSecret) return res.status(401).json({ error: 'Unauthorized' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return res.status(500).json({ error: 'Server not configured (Supabase keys missing)' });

  const body = req.body || {};
  const { email, name, last_name, role, company, redirectTo } = body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Check existing user (legacy check removed)

    // supabase-js may not expose listUsersByEmail; fallback to trying to create and handle dup error
    let user: any = null;

    // Try create user using admin API
    const tmpPassword =
      Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
    let createRes: any;
    try {
      createRes = await (supabase.auth as any).admin.createUser({
        email,
        password: tmpPassword,
        email_confirm: false,
      });
    } catch (err) {
      // Some Supabase SDK versions throw; try to detect conflict
      const msg = String(err || '');
      if (msg.includes('already exists')) {
        // try to fetch existing user
        const { data: userData } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();
        if (userData?.user_id) {
          user = { id: userData.user_id };
        }
      } else {
        throw err;
      }
    }

    if (!user && createRes && createRes.user) user = createRes.user;

    if (!user) {
      // If user still not found, try to search auth.users
      try {
        const { data: users } = await supabase.rpc('get_user_by_email', { p_email: email }); // optional helper; may not exist
        if (users?.length) user = users[0];
      } catch {
        // ignore
      }
    }

    // If user does not exist at this point, return error
    if (!user) return res.status(500).json({ error: 'Could not create or find user' });

    // Create or update profile row
    const profilePayloadUserId: any = {
      user_id: user.id,
      email,
      name: name || null,
      last_name: last_name || null,
      role: role || null,
      company: company || null,
    };

    // Try upsert using legacy "user_id" column first, fall back to using "id" PK if that column does not exist
    let upErr: any = null;
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert(profilePayloadUserId, { onConflict: 'user_id' });
      upErr = error;
    } catch (e: any) {
      // detect missing column error and fall through to try with id
      upErr = e;
    }

    if (upErr) {
      // Try with 'id' column (some schemas use `id` as the PK matching auth.users.id)
      const profilePayloadId: any = {
        id: user.id,
        email,
        name: name || null,
        last_name: last_name || null,
        role: role || null,
        company: company || null,
      };
      const { error: idErr } = await supabase
        .from('profiles')
        .upsert(profilePayloadId, { onConflict: 'id' });
      if (idErr) throw idErr;
    }

    // Send reset link
    const redirect =
      redirectTo ||
      process.env.RESET_REDIRECT_URL ||
      (process.env.VITE_SUPABASE_URL
        ? `${process.env.VITE_SUPABASE_URL}/auth/password-reset`
        : undefined);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirect,
    });
    if (resetErr) throw resetErr;

    // Record audit
    const auditPayload = {
      user_id: user.id,
      email,
      created_by: null,
      meta: { origin: 'admin_api', actor: req.headers['x-admin-actor'] || null, body: body },
    };
    await supabase.from('user_creation_audit').insert(auditPayload);

    return res.status(201).json({ userId: user.id, email });
  } catch (err: any) {
    console.error('create-user error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
