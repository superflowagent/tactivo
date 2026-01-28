#!/usr/bin/env node
const { Client } = require('pg');

(async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    });
    try {
        await client.connect();
        console.log('Connected to DB, running verification test...');

        // Ensure there is a company
        let res = await client.query("SELECT id FROM public.companies LIMIT 1");
        let companyId;
        if (res.rows.length === 0) {
            res = await client.query("INSERT INTO public.companies (id, name) VALUES (gen_random_uuid(), 'Test Company') RETURNING id");
            companyId = res.rows[0].id;
        } else {
            companyId = res.rows[0].id;
        }

        const profileId = '00000000-0000-0000-0000-000000000001';
        const profileUser = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

        // Cleanup any existing test artifacts
        await client.query('DELETE FROM public.events WHERE client && ARRAY[$1::uuid]', [profileUser]);
        await client.query('DELETE FROM public.profiles WHERE id = $1 OR "user" = $2', [profileId, profileUser]);

        // Ensure auth user exists (profiles.user FK requires auth.users)
        await client.query(
            `INSERT INTO auth.users (id, email, created_at) 
       SELECT $1::uuid, 'test@example.org', now() 
       WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = $1::uuid)`
            , [profileUser]
        );

        // Create profile
        await client.query(
            `INSERT INTO public.profiles (id, "user", name, role, company, class_credits)
       VALUES ($1::uuid, $2::uuid, 'Test', 'client', $3::uuid, 5)`,
            [profileId, profileUser, companyId]
        );

        // Insert event using user id in client array
        const insertRes = await client.query(
            `INSERT INTO public.events (id, company, type, datetime, client, duration)
       VALUES (gen_random_uuid(), $1::uuid, 'class', now(), ARRAY[$2::uuid], 60) RETURNING id`,
            [companyId, profileUser]
        );
        const eventId = insertRes.rows[0].id;

        // Check credits
        const creditsRes = await client.query('SELECT id, "user", class_credits FROM public.profiles WHERE id = $1::uuid', [profileId]);
        console.log('Profile after event insert:', creditsRes.rows[0]);

        const expected = 4;
        if (Number(creditsRes.rows[0].class_credits) === expected) {
            console.log('✅ Credits deducted as expected.');
        } else {
            console.log('❌ Unexpected credits value:', creditsRes.rows[0].class_credits);
        }

        // Cleanup
        await client.query('DELETE FROM public.events WHERE id = $1::uuid', [eventId]);
        await client.query('DELETE FROM public.profiles WHERE id = $1::uuid', [profileId]);
        await client.query('DELETE FROM auth.users WHERE id = $1::uuid', [profileUser]);

        await client.end();
        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        try { await client.end(); } catch { };
        process.exit(1);
    }
})();