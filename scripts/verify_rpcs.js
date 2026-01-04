import fs from 'fs';
(async () => {
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        const svc = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
        const anon = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
        const base = 'https://hzztmtkdaofrwcwzotas.supabase.co';
        const headers = { 'apikey': svc, 'Authorization': 'Bearer ' + svc, 'Content-Type': 'application/json' };

        const adminCreate = async (email) => {
            const r = await fetch(base + '/auth/v1/admin/users', { method: 'POST', headers, body: JSON.stringify({ email, password: 'Password123!' }) });
            const j = await r.json();
            return { status: r.status, body: j };
        }

        // Use supabase-js for sign-in to avoid REST body mismatches
        const { createClient } = await import('@supabase/supabase-js')
        const anonClient = createClient(base, anon)
        const signIn = async (email) => {
            const r = await anonClient.auth.signInWithPassword({ email, password: 'Password123!' })
            // Normalize response
            if (r.error) return { status: r.error.status || 400, body: { error: r.error.message } }
            return { status: 200, body: r.data }
        }

        console.log('Ensure users exist; fetch by email');
        const listUsers = async () => { const r = await fetch(base + '/auth/v1/admin/users', { method: 'GET', headers }); const j = await r.json(); return { status: r.status, body: j }; }
        const resUsers = await listUsers();
        console.log('list users status', resUsers.status);
        console.log('list users body sample', JSON.stringify(resUsers.body)?.slice(0, 1000));
        const users = Array.isArray(resUsers.body) ? resUsers.body : (Array.isArray(resUsers.body?.users) ? resUsers.body.users : []);
        const c = users.find(u => u.email === 'testclient+002@example.com');
        const p = users.find(u => u.email === 'testprofessional+002@example.com');
        console.log('found client', !!c, 'found prof', !!p);
        const clientId = c?.id;
        const profId = p?.id;
        console.log('client id', clientId, 'prof id', profId);
        const companyId = 'c2ca341f-9c83-4c33-98f5-01a98c910106';
        if (!clientId || !profId) { console.error('User lookup failed; abort'); process.exit(1); }

        const createProfile = async (uId, role, name, last) => {
            const r = await fetch(base + '/rest/v1/profiles', { method: 'POST', headers, body: JSON.stringify({ id: uId, user: uId, role: role, company: companyId, name: name, last_name: last }), });
            return { status: r.status, body: await r.text() };
        }

        const adminPutUser = async (uId, putBody) => {
            const r = await fetch(base + '/auth/v1/admin/users/' + uId, { method: 'PUT', headers, body: JSON.stringify(putBody) });
            return { status: r.status, body: await r.text() };
        }

        console.log('Creating profiles...');
        console.log('client profile', await createProfile(clientId, 'client', 'Cli', 'Ent'));
        console.log('prof profile', await createProfile(profId, 'professional', 'Pro', 'Fes'));

        // Ensure email confirmed to allow sign-in
        console.log('Confirming users to allow sign-in...');
        const clientIdentityId = c?.identities?.[0]?.identity_id || c?.identities?.[0]?.id;
        const profIdentityId = p?.identities?.[0]?.identity_id || p?.identities?.[0]?.id;
        const clientConfirmBody = {
            email_confirmed_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
            identities: [{ identity_id: clientIdentityId, id: clientIdentityId, provider: 'email', identity_data: { email: c.email, email_verified: true, phone_verified: false, sub: c.id } }]
        }
        const profConfirmBody = {
            email_confirmed_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
            identities: [{ identity_id: profIdentityId, id: profIdentityId, provider: 'email', identity_data: { email: p.email, email_verified: true, phone_verified: false, sub: p.id } }]
        }
        console.log('put client', await adminPutUser(clientId, clientConfirmBody));
        console.log('put prof', await adminPutUser(profId, profConfirmBody));

        // Sign in to get tokens
        console.log('Signing in as client...'); const sClient = await signIn('testclient+002@example.com'); console.log('client sign-in status', sClient.status, JSON.stringify(sClient.body).slice(0, 200));
        console.log('Signing in as professional...'); const sProf = await signIn('testprofessional+002@example.com'); console.log('professional sign-in status', sProf.status, JSON.stringify(sProf.body).slice(0, 200));
        const clientToken = sClient.body?.session?.access_token || sClient.body?.access_token || sClient.body?.accessToken || sClient.body?.session?.accessToken;
        const profToken = sProf.body?.session?.access_token || sProf.body?.access_token || sProf.body?.accessToken || sProf.body?.session?.accessToken;
        if (!clientToken || !profToken) { console.error('Sign-in failed, abort'); console.error('client body', sClient.body); console.error('prof body', sProf.body); process.exit(1) }

        // Call RPC as client
        const rpcCall = async (token, rpcName, body) => {
            const r = await fetch(base + `/rest/v1/rpc/${rpcName}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': anon, 'Authorization': 'Bearer ' + token }, body: JSON.stringify(body) });
            return { status: r.status, body: await r.text() };
        }

        console.log('RPC client get_profiles_by_ids_for_clients', await rpcCall(clientToken, 'get_profiles_by_ids_for_clients', { p_ids: [clientId] }));
        console.log('RPC prof get_profiles_by_ids_for_professionals', await rpcCall(profToken, 'get_profiles_by_ids_for_professionals', { p_ids: [clientId] }));

        // Test the new RPC to fetch companies safely as authenticated members
        console.log('RPC client get_company_by_id', await rpcCall(clientToken, 'get_company_by_id', { p_company: companyId }));
        console.log('RPC prof get_company_by_id', await rpcCall(profToken, 'get_company_by_id', { p_company: companyId }));

    // Check membership helper function result
    console.log('RPC is_member_of_company as client', await rpcCall(clientToken, 'is_member_of_company', { p_company: companyId }));
    console.log('RPC is_member_of_company as prof', await rpcCall(profToken, 'is_member_of_company', { p_company: companyId }));
        console.log('DONE');
    } catch (e) { console.error('ERR', e); process.exit(1); }
})();
