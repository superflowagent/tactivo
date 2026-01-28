#!/usr/bin/env node
const fs = require('fs');
const { Client } = require('pg');

(async () => {
    try {
        const sqlPath = process.argv[2] || 'supabase/migrations/20260128120000_adjust_class_credits_fix.sql';
        const sql = fs.readFileSync(sqlPath, 'utf8');

        const client = new Client({
            connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
        });

        await client.connect();
        console.log('Connected to DB, executing SQL...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('SQL applied successfully.');
        await client.end();
        process.exit(0);
    } catch (err) {
        console.error('Error applying SQL:', err);
        process.exit(1);
    }
})();