const { Client } = require('pg');

(async () => {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('No DATABASE_URL set in env');
      process.exit(2);
    }
    console.log('Attempting to connect to:', dbUrl.replace(/:\/\/.*@/, '://[REDACTED]@'));
    const client = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 5000 });
    await client.connect();
    const res = await client.query('SELECT version() as v, inet_server_addr() as ip');
    console.log('Connected. Server version and IP:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection error:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
    process.exit(1);
  }
})();
