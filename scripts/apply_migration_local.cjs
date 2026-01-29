#!/usr/bin/env node
// Apply a single SQL migration file to the local DB safely.
// - Reads DATABASE_URL from .env.local if present, else from env
// - Backs up current storage.objects policies to a JSON file before applying
// - Executes the SQL file in a transaction

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  let env = {};
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_0-9]+)=(.*)$/);
      if (m) {
        let val = m[2];
        // strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[m[1]] = val;
      }
    });
  }

  const DATABASE_URL = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not found in environment or .env.local');
    process.exit(1);
  }

  const sqlFile = path.resolve(__dirname, '..', 'supabase', 'migrations', '20260129193000_relax_exercise_videos_policies.sql');
  if (!fs.existsSync(sqlFile)) {
    console.error('Migration SQL not found:', sqlFile);
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    console.log('Backing up existing storage.objects policies...');
    const res = await client.query("SELECT p.polname, p.polcmd, pg_get_expr(p.polqual, p.polrelid) AS using_expr, pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid WHERE c.relname = 'objects';");
    const backup = res.rows;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.resolve(__dirname, `policies_backup_storage_objects_${ts}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log('Policies backed up to', backupPath);

    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log('Applying migration:', sqlFile);

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('Migration applied successfully.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch(e){}
    console.error('Error applying migration:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err)=>{console.error(err); process.exit(1);});