// List auth.users rows using DATABASE_URL from .env.local (CommonJS)
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
  try {
    await client.connect();
    const res = await client.query("SELECT id, email, raw_user_meta_data, created_at, confirmed_at FROM auth.users ORDER BY created_at ASC");
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
  } catch (err) {
    console.error('Error querying auth.users:', err);
    process.exit(1);
  }
})();
