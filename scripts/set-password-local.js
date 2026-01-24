// Usage: node scripts/set-password-local.js <email> <newPassword>
// Requires environment variables: SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY

const [, , email, password] = process.argv;
if (!email || !password) {
    console.error('Usage: node scripts/set-password-local.js <email> <newPassword>');
    process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
    process.exit(1);
}

(async () => {
    try {
        // Fetch profile to get user id (select all columns and match by email)
        const profileRes = await fetch(
            `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?select=*&email=eq.${encodeURIComponent(email)}`
            , {
                headers: {
                    apikey: SUPABASE_SERVICE_ROLE_KEY,
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    Accept: 'application/json'
                }
            });

        if (!profileRes.ok) {
            const txt = await profileRes.text().catch(() => null);
            throw new Error(`Error fetching profile: ${profileRes.status} ${txt}`);
        }

        const profiles = await profileRes.json();
        let userId = null;
        if (Array.isArray(profiles) && profiles.length > 0) {
            // profile may have user, user_id, or id depending on schema
            userId = profiles[0].user || profiles[0].user_id || profiles[0].id || null;
            console.log('Found profile:', JSON.stringify(profiles[0]));
            console.log('Derived userId:', userId);
        }

        if (!userId) {
            // Try auth admin list users (best effort)
            console.log('Profile not found; attempting to look up auth users via admin list...');
            const usersRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
                headers: {
                    apikey: SUPABASE_SERVICE_ROLE_KEY,
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            if (usersRes.ok) {
                const users = await usersRes.json();
                const found = users.find(u => u.email === email);
                if (found) userId = found.id;
            }
        }

        if (!userId) {
            throw new Error('User not found by email');
        }

        // Update password via admin API (use PUT for compatibility with local Supabase)
        console.log('Updating password for user id', userId);
        const patchRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        const patchText = await patchRes.text().catch(() => null);
        let patchJson = null;
        try { patchJson = patchText ? JSON.parse(patchText) : null; } catch { }

        if (!patchRes.ok) {
            throw new Error(`Failed to update password: ${patchRes.status} ${patchJson || patchText}`);
        }

        console.log(`Password updated for user ${email} (id: ${userId}).`);
    } catch (err) {
        console.error('Error:', err?.message || err);
        process.exit(1);
    }
})();
