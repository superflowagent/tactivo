import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Usage:
// SUPABASE_URL=https://xyz.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/upload-exercise-videos.js

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_EXERCISE_BUCKET || 'exercise-videos';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function ensureBucket() {
    try {
        const { data: bucket } = await supabase.storage.getBucket(BUCKET);
        if (!bucket) {
            console.log('Creating bucket', BUCKET, 'as public');
            const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
            if (error) throw error;
        } else {
            console.log('Bucket exists:', BUCKET);
        }
    } catch (err) {
        console.error('Error ensuring bucket:', err.message || err);
        throw err;
    }
}

async function uploadFile(localPath, destPath) {
    const stats = fs.statSync(localPath);
    const fileStream = fs.createReadStream(localPath);
    try {
        const { data, error } = await supabase.storage.from(BUCKET).upload(destPath, fileStream, { upsert: true });
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(destPath);
        console.log(`Uploaded: ${destPath} (size: ${stats.size}) -> ${publicUrlData.publicUrl}`);
    } catch (err) {
        console.error('Upload error for', destPath, err.message || err);
        throw err;
    }
}

async function main() {
    const dir = path.join(process.cwd(), 'public', 'landing', 'exercises');
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp4'));
    if (files.length === 0) {
        console.log('No mp4 files found in', dir);
        return;
    }

    await ensureBucket();

    for (const f of files) {
        const local = path.join(dir, f);
        // keep same filename in bucket
        await uploadFile(local, f);
    }

    console.log('All done. To use these files point VITE_EXERCISE_VIDEO_BASE to the public bucket base URL (get example above).');
}

main().catch((err) => {
    console.error('Fatal error', err);
    process.exit(1);
});