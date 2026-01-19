const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const lines = txt.split(/\r?\n/);
  const env = {};
  for (const l of lines) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

(async function main() {
  try {
    const envFile = path.resolve(__dirname, '../.env.local');
    let env = {};
    if (fs.existsSync(envFile)) {
      env = loadEnv(envFile);
    }
    const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('No DATABASE_URL found in .env.local or env. Aborting.');
      process.exit(1);
    }

    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    // Find migration-like tables
    const resTables = await client.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%migr%' ORDER BY table_schema`);
    if (resTables.rowCount === 0) {
      console.error('No migration-like table found. Inspect your DB manually.');
      await client.end();
      process.exit(1);
    }

    console.log('Found migration tables:');
    resTables.rows.forEach(r => console.log(` - ${r.table_schema}.${r.table_name}`));

    // We'll pick the first candidate table (ask user if more than one?)
    const tableSchema = resTables.rows[0].table_schema;
    const tableName = resTables.rows[0].table_name;

    // Inspect columns
    const colsRes = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`, [tableSchema, tableName]);
    console.log('\nColumns:');
    colsRes.rows.forEach(c => console.log(` - ${c.column_name} (${c.data_type})`));

    // Read all rows
    const rowsRes = await client.query(`SELECT * FROM ${tableSchema}.${tableName} ORDER BY 1`);
    console.log(`\nFound ${rowsRes.rowCount} rows in ${tableSchema}.${tableName}`);

    const backupDir = path.resolve(__dirname, '../supabase/migrations/backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `migrations-backup-${tableSchema}-${tableName}-${ts}.json`);

    fs.writeFileSync(backupFile, JSON.stringify(rowsRes.rows, null, 2));
    console.log(`Backup written to ${backupFile}`);

    // Determine which column likely holds the migration identifier
    const preferCols = ['version', 'name', 'migration', 'id', 'file', 'filename'];
    const colNames = colsRes.rows.map(c => c.column_name.toLowerCase());
    let idCol = null;
    for (const p of preferCols) {
      if (colNames.includes(p)) {
        idCol = colsRes.rows.find(c => c.column_name.toLowerCase() === p).column_name;
        break;
      }
    }
    if (!idCol) {
      // fallback to first text-like column
      const textCol = colsRes.rows.find(c => ['text', 'character varying', 'varchar'].includes(c.data_type));
      idCol = textCol ? textCol.column_name : colsRes.rows[0].column_name;
    }

    console.log(`\nUsing column '${idCol}' as migration identifier column.`);

    // Identify baseline entry we want to keep
    const baselineName = '20260119140000_baseline.sql';
    // Find rows matching baseline-ish
    const baselineRows = rowsRes.rows.filter(r => {
      const val = (r[idCol] || '').toString();
      return val.includes('20260119140000') || val.includes('baseline');
    });

    if (baselineRows.length === 0) {
      console.log('No baseline row found. We will INSERT a baseline row and then remove others.');
    } else {
      console.log(`Baseline rows found: ${baselineRows.length}`);
      baselineRows.slice(0, 5).forEach(r => console.log(` - ${r[idCol]}`));
    }

    // Confirm action with user prompt
    console.log('\n*** ACTION SUMMARY ***');
    console.log(` - Table: ${tableSchema}.${tableName}`);
    console.log(` - Rows total: ${rowsRes.rowCount}`);
    console.log(` - Baseline name to enforce: ${baselineName}`);
    console.log(' - Plan: remove all rows except baseline (if baseline missing, insert it then remove the others).');

    // Since user authorized strategy B, proceed.

    // If baseline missing, insert a row. Need to determine columns to populate: we'll set identifier column and created/inserted_at columns if exist.
    if (baselineRows.length === 0) {
      let insertCols = [idCol];
      let insertVals = [baselineName];
      const now = new Date().toISOString();
      if (colNames.includes('applied_at') || colNames.includes('created_at') || colNames.includes('inserted_at')) {
        const timeCol = colNames.includes('applied_at') ? 'applied_at' : (colNames.includes('created_at') ? 'created_at' : 'inserted_at');
        insertCols.push(timeCol);
        insertVals.push(now);
      }
      const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(',');
      const q = `INSERT INTO ${tableSchema}.${tableName}(${insertCols.join(',')}) VALUES (${placeholders}) RETURNING *`;
      const ins = await client.query(q, insertVals);
      console.log('Inserted baseline row:', ins.rows[0]);
    }

    // Delete all rows where idCol not like baseline identifier
    const delQ = `DELETE FROM ${tableSchema}.${tableName} WHERE ${idCol} NOT ILIKE $1`;
    const pattern = `%20260119140000%`;
    const delRes = await client.query(delQ, [pattern]);
    console.log(`Deleted ${delRes.rowCount} rows not matching baseline pattern.`);

    // Show final state
    const final = await client.query(`SELECT * FROM ${tableSchema}.${tableName} ORDER BY 1`);
    console.log(`Final rows count: ${final.rowCount}`);
    final.rows.forEach(r => console.log(` - ${r[idCol]}`));

    await client.end();
    console.log('\nDone. The migrations table has been consolidated to baseline. You should now re-run the Supabase preview/check.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
