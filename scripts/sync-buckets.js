/* sync-buckets.js removed per user request. See git history for previous content. */

console.log('sync-buckets.js removed by request.');

function env(name) {
    return process.env[name] || '';
}

async function listBuckets(url, key) {
    const res = await fetch(`${url.replace(/\/$/, '')}/storage/v1/bucket`, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
        },
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Failed to list buckets from ${url}: ${res.status} ${res.statusText} - ${t}`);
    }
    return res.json();
}

async function createBucket(url, key, bucket) {
    const body = {
        name: bucket.name,
        // supabase storage create accepts 'public' boolean and optional 'id', 'allowed_mime_types', 'file_size_limit'
        public: bucket.public || false,
        id: bucket.id,
        file_size_limit: bucket.file_size_limit || null,
        allowed_mime_types: bucket.allowed_mime_types || null,
    };

    // Remove nulls to be safe
    Object.keys(body).forEach(k => body[k] === null && delete body[k]);

    const res = await fetch(`${url.replace(/\/$/, '')}/storage/v1/bucket`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: key,
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
    });

    if (res.status === 409) {
        console.log(`  - Bucket "${bucket.name}" already exists locally (conflict).`);
        return null;
    }

    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Failed to create bucket ${bucket.name} on ${url}: ${res.status} ${res.statusText} - ${t}`);
    }

    return res.json();
}

async function bucketExistsLocally(localBuckets, bucket) {
    return localBuckets.some(b => b.name === bucket.name || b.id === bucket.id);
}

(async function main() {
    try {
        const REMOTE_SUPABASE_URL = env('REMOTE_SUPABASE_URL');
        const REMOTE_SUPABASE_KEY = env('REMOTE_SUPABASE_KEY');
        const LOCAL_SUPABASE_URL = env('LOCAL_SUPABASE_URL');
        const LOCAL_SUPABASE_KEY = env('LOCAL_SUPABASE_KEY');

        if (!REMOTE_SUPABASE_URL || !REMOTE_SUPABASE_KEY || !LOCAL_SUPABASE_URL || !LOCAL_SUPABASE_KEY) {
            console.error('Missing env vars. Required: REMOTE_SUPABASE_URL, REMOTE_SUPABASE_KEY, LOCAL_SUPABASE_URL, LOCAL_SUPABASE_KEY');
            process.exit(1);
        }

        console.log('Fetching buckets from remote...');
        const remoteBuckets = await listBuckets(REMOTE_SUPABASE_URL, REMOTE_SUPABASE_KEY);
        console.log(`Found ${remoteBuckets.length} remote bucket(s).`);

        console.log('Fetching buckets from local...');
        const localBuckets = await listBuckets(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_KEY);

        for (const b of remoteBuckets) {
            console.log(`\n- Bucket: ${b.name} (id: ${b.id})`);
            const exists = await bucketExistsLocally(localBuckets, b);
            if (exists) {
                console.log('  -> already exists locally. Skipping creation.');
                // Optional: could attempt to patch/public settings if needed
                continue;
            }

            console.log('  -> creating locally...');
            try {
                const created = await createBucket(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_KEY, b);
                console.log('  -> created:', created && created.name ? created.name : 'ok');
            } catch (err) {
                console.error('  -> failed:', err.message);
            }

            console.log('  Note: bucket policies (RLS, Postgres policies) and custom ACLs are NOT copied automatically.');
            console.log('  If you have custom policies, export them from remote and apply to local (e.g., SQL dump of policies or using `supabase db` tools`).');
        }

        console.log('\nDone. Review the output for any errors and migrate policies manually if needed.');
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
})();
