#!/usr/bin/env node
/*
Script to detect and correct swapped buckets between company logos and exercise videos.
Usage:
  node scripts/fix_swapped_buckets.js --dry-run
  node scripts/fix_swapped_buckets.js --apply

Requires env vars:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

This script will:
 - For each company with a non-empty `logo_path`, check if the object exists in `company_logos`.
   If not present there and present in `exercise_videos`, copy it to `company_logos` under `companyId/<basename>` and update DB.
 - For each exercise with a non-empty `file`, check if the object exists in `exercise_videos`.
   If not present there and present in `company_logos`, copy it to `exercise_videos` under `exerciseId/<basename>` and update DB.

The script defaults to a dry-run; use --apply to perform uploads and DB updates.
*/

const { argv } = require('process');
const fetch = globalThis.fetch || require('node-fetch');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
    process.exit(1);
}

const DO_APPLY = argv.includes('--apply') || argv.includes('-a');
const COMPANY_BUCKET = 'company_logos';
const EXERCISE_BUCKET = 'exercise_videos';

function basename(p) {
    if (!p) return p;
    const parts = String(p).split('/');
    return parts[parts.length - 1];
}

async function listObject(bucket, prefix) {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/list/${encodeURIComponent(bucket)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({ prefix: String(prefix || '') }),
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    return j; // array of objects
}

async function downloadObject(bucket, path) {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } });
    if (!res.ok) throw new Error(`download failed ${res.status}`);
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    return { buffer: Buffer.from(buffer), contentType };
}

async function uploadObject(bucket, path, buffer, contentType) {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            'Content-Type': contentType,
            'x-upsert': 'true'
        },
        body: buffer
    });
    const txt = await res.text();
    let json = null;
    try { json = JSON.parse(txt); } catch { json = txt; }
    if (!res.ok) throw new Error(`upload failed ${res.status}: ${JSON.stringify(json)}`);
    return json;
}

async function patchTable(table, keyField, idValue, patch) {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?${encodeURIComponent(keyField)}=eq.${encodeURIComponent(idValue)}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            Prefer: 'return=representation'
        },
        body: JSON.stringify(patch)
    });
    const txt = await res.text();
    let json = null;
    try { json = JSON.parse(txt); } catch { json = txt; }
    if (!res.ok) throw new Error(`patch ${table} failed ${res.status}: ${JSON.stringify(json)}`);
    return json;
}

async function processCompanies() {
    console.log('\nScanning companies for swapped logos...');
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/companies?select=id,logo_path&logo_path=not.is.null`;
    const res = await fetch(url, { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } });
    if (!res.ok) throw new Error('failed to list companies');
    const companies = await res.json();
    for (const c of companies) {
        const id = c.id;
        const logo = c.logo_path;
        if (!logo) continue;
        // Check in company bucket
        const inCompany = await listObject(COMPANY_BUCKET, logo);
        const foundInCompany = Array.isArray(inCompany) && inCompany.some(o => o.name === logo || o.name === (id + '/' + basename(logo)));
        if (foundInCompany) continue;
        // Not found in company bucket: check exercise bucket
        const inExercise = await listObject(EXERCISE_BUCKET, logo);
        const foundInExercise = Array.isArray(inExercise) && inExercise.some(o => o.name === logo);
        if (!foundInExercise) {
            console.log(`Company ${id}: logo_path ${logo} not found in either bucket (skip)`);
            continue;
        }
        const srcPath = logo;
        const dstPath = `${id}/${basename(logo)}`;
        console.log(`Company ${id}: logo ${logo} found in ${EXERCISE_BUCKET} -> will copy to ${COMPANY_BUCKET}/${dstPath}`);
        if (!DO_APPLY) continue;
        try {
            const { buffer, contentType } = await downloadObject(EXERCISE_BUCKET, srcPath);
            // if target exists, avoid overwrite by appending timestamp
            const targetCheck = await listObject(COMPANY_BUCKET, dstPath);
            const targetExists = Array.isArray(targetCheck) && targetCheck.some(o => o.name === dstPath);
            let finalDst = dstPath;
            if (targetExists) {
                const ts = Date.now();
                finalDst = `${id}/${ts}_${basename(logo)}`;
                console.log(`Target exists, using ${finalDst}`);
            }
            await uploadObject(COMPANY_BUCKET, finalDst, buffer, contentType);
            await patchTable('companies', 'id', id, { logo_path: finalDst });
            console.log(`Company ${id}: migrated logo to ${COMPANY_BUCKET}/${finalDst} and updated DB`);
        } catch (e) {
            console.error('Error processing company', id, e);
        }
    }
}

async function processExercises() {
    console.log('\nScanning exercises for swapped files...');
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/exercises?select=id,file&file=not.is.null`;
    const res = await fetch(url, { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } });
    if (!res.ok) throw new Error('failed to list exercises');
    const rows = await res.json();
    for (const r of rows) {
        const id = r.id;
        const file = r.file;
        if (!file) continue;
        const inExercise = await listObject(EXERCISE_BUCKET, file);
        const foundInExercise = Array.isArray(inExercise) && inExercise.some(o => o.name === file || o.name === (id + '/' + basename(file)));
        if (foundInExercise) continue;
        const inCompany = await listObject(COMPANY_BUCKET, file);
        const foundInCompany = Array.isArray(inCompany) && inCompany.some(o => o.name === file);
        if (!foundInCompany) {
            console.log(`Exercise ${id}: file ${file} not found in either bucket (skip)`);
            continue;
        }
        const srcPath = file;
        const dstPath = `${id}/${basename(file)}`;
        console.log(`Exercise ${id}: file ${file} found in ${COMPANY_BUCKET} -> will copy to ${EXERCISE_BUCKET}/${dstPath}`);
        if (!DO_APPLY) continue;
        try {
            const { buffer, contentType } = await downloadObject(COMPANY_BUCKET, srcPath);
            const targetCheck = await listObject(EXERCISE_BUCKET, dstPath);
            const targetExists = Array.isArray(targetCheck) && targetCheck.some(o => o.name === dstPath);
            let finalDst = dstPath;
            if (targetExists) {
                const ts = Date.now();
                finalDst = `${id}/${ts}_${basename(file)}`;
                console.log(`Target exists, using ${finalDst}`);
            }
            await uploadObject(EXERCISE_BUCKET, finalDst, buffer, contentType);
            await patchTable('exercises', 'id', id, { file: finalDst });
            console.log(`Exercise ${id}: migrated file to ${EXERCISE_BUCKET}/${finalDst} and updated DB`);
        } catch (e) {
            console.error('Error processing exercise', id, e);
        }
    }
}

(async () => {
    try {
        console.log('Script mode:', DO_APPLY ? 'APPLY' : 'DRY-RUN');
        await processCompanies();
        await processExercises();
        console.log('\nDone');
    } catch (e) {
        console.error('Fatal error', e);
        process.exitCode = 1;
    }
})();
