// Delete specific ghost users from auth.users (CommonJS)
const fs = require('fs');
const path = require('path');

function loadEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[m[1]] = val;
    }
  }
  return env;
}

(async () => {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found at', envPath);
    process.exit(1);
  }
  const env = loadEnv(envPath);
  const DATABASE_URL = env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: DATABASE_URL });

  // IDs to delete (the ghost users)
  const idsToDelete = [
    '877c5a4d-cdfd-4cb3-8d44-b074a8836e85',
    '9cb72562-9e70-433b-85b7-9e700c6f2d75',
    '2c1546b6-5640-4d0e-ae77-178086e78a9d',
    '0be31270-cb0e-4bc4-b606-1e1c70c8bccb',
    '1cfafd1d-68d5-4930-aae7-f76d090ae9fa',
    'b8675549-8841-455f-bc25-d1de204162b6',
    '1a0290ab-7990-4a2d-a768-428caa5d5a65',
    '82190953-3cdc-4901-8f49-b5a81e5768bf',
    '90339e7a-b396-466d-987d-7ef38b680956'
  ];

  try {
    await client.connect();
    await client.query('BEGIN');

    // Check which of the target IDs actually exist
    const chk = await client.query('SELECT id FROM auth.users WHERE id = ANY($1::uuid[])', [idsToDelete]);
    const present = chk.rows.map(r => r.id);

    if (present.length === 0) {
      console.log('No matching ghost users found to delete.');
      await client.query('ROLLBACK');
      await client.end();
      process.exit(0);
    }

    // Delete and return deleted ids
    const del = await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[]) RETURNING id', [idsToDelete]);
    const deleted = del.rows.map(r => r.id);

    await client.query('COMMIT');

    const remRes = await client.query('SELECT COUNT(*) AS cnt FROM auth.users');
    const remainingCount = parseInt(remRes.rows[0].cnt, 10);

    console.log(JSON.stringify({ deleted_count: deleted.length, deleted_ids: deleted, remaining_users: remainingCount }, null, 2));

    await client.end();
    process.exit(0);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) {}
    console.error('Error during deletion:', err);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
})();
