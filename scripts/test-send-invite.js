/*
Simple script to call the deployed or local `send-invite` function.
Usage examples:
  SUPABASE_URL=https://your.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/test-send-invite.js --profile-id <profile-id>

Or use ADMIN_SECRET with x-admin-secret header instead of Authorization Bearer.
*/
const fetch = require('node-fetch');
const argv = require('minimist')(process.argv.slice(2));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('Please set SUPABASE_URL');
  process.exit(1);
}

const target = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/send-invite`;

(async () => {
  try {
    const body = {};
    if (argv['profile-id']) body.profile_id = argv['profile-id'];
    if (argv.email) body.email = argv.email;
    if (!body.profile_id && !body.email) {
      console.error('Provide --profile-id or --email');
      process.exit(1);
    }

    const headers = { 'Content-Type': 'application/json' };
    if (ADMIN_SECRET) headers['x-admin-secret'] = ADMIN_SECRET;
    else if (SERVICE_ROLE) headers['Authorization'] = `Bearer ${SERVICE_ROLE}`;
    else console.warn('No ADMIN_SECRET or SERVICE_ROLE provided; request may be unauthorized');

    console.log('POST', target, body, headers);
    const res = await fetch(target, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    console.log('Status', res.status);
    console.log('Response:', JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('Error calling function', e);
    process.exit(1);
  }
})();
