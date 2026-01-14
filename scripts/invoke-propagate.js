#!/usr/bin/env node
// Simple script to invoke the local propagate-classes function for manual testing.
// Usage: node scripts/invoke-propagate.js <company> <month> <year>

const fetch = globalThis.fetch || require('node-fetch');
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!process.argv[2] || !process.argv[3] || !process.argv[4]) {
  console.error('Usage: node scripts/invoke-propagate.js <company> <month> <year>');
  process.exit(1);
}

const [company, month, year] = process.argv.slice(2, 5);

(async () => {
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/propagate-classes`;
    const sampleTemplate = {
      id: 'sample',
      day: 1,
      time: '10:00',
      duration: 60,
      client: [],
      professional: [],
      notes: 'Test propagate',
    };

    const headers = { 'Content-Type': 'application/json' };
    if (ADMIN_SECRET) headers['x-admin-secret'] = ADMIN_SECRET;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        company,
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        templates: [sampleTemplate],
      }),
    });

    const json = await res.json().catch(() => null);
    console.log('status:', res.status);
    console.log('response:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('invoke failed:', err);
    process.exit(2);
  }
})();
