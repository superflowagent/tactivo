import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SERVICE_ROLE_KEY;
const NUM = parseInt(process.env.NUM_SEED || '5');
const FILES_DIR = process.env.FILES_DIR || './sample_files';
const BUCKET = process.env.BUCKET || 'public';

if (!url || !key) {
  console.error('Set SUPABASE_URL and SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets.find(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
    console.log('Bucket created:', BUCKET);
  }
}

function randId() {
  return Math.random().toString(36).slice(2,17);
}

async function createCompanies() {
  const rows = [];
  for (let i=0;i<NUM;i++){
    rows.push({
      id: randId(),
      name: `Company ${i+1}`,
      open_time: '09:00',
      close_time: '20:00',
    });
  }
  const { error } = await supabase.from('companies').insert(rows);
  if(error) throw error;
  return rows;
}

async function createUsersAndProfiles(companies) {
  const users = [];
  for (let i=0;i<NUM;i++) {
    const email = `test+${i+1}@example.com`;
    const password = `Tactivo2025!${i+1}`;
    const { data: userData, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: `User${i+1}`, last_name: 'Test' }
    });
    if(error) throw error;
    const profile = {
      id: userData.user.id,
      name: `User${i+1}`,
      last_name: 'Test',
      role: i===0 ? 'professional' : 'client',
      company_id: companies[i % companies.length].id
    };
    const { error: pErr } = await supabase.from('profiles').insert(profile);
    if (pErr) throw pErr;
    users.push({ email, password, profile });
  }
  return users;
}

async function seedEntities(companies, users) {
  const anatomy = [];
  const equipment = [];
  const exercises = [];
  const classes_template = [];
  const events = [];
  const user_cards = [];

  for (let i=0;i<NUM;i++){
    const cid = randId();
    anatomy.push({ id: cid, name: `Anatomy ${i+1}`, company_id: companies[i%companies.length].id });
    const eqid = randId();
    equipment.push({ id: eqid, name: `Equipment ${i+1}`, company_id: companies[i%companies.length].id });
    exercises.push({ id: randId(), name: `Exercise ${i+1}`, company_id: companies[i%companies.length].id, equipment_ids: [eqid], anatomy_ids: [cid] });
    classes_template.push({ id: randId(), type: 'class', datetime: new Date().toISOString(), duration: 60, company_id: companies[i%companies.length].id });
    events.push({ id: randId(), type: 'class', datetime: new Date().toISOString(), duration: 60, company_id: companies[i%companies.length].id, client_ids: [users[i].profile.id] });
    user_cards.push({ id: randId(), user_id: users[i].profile.id, name: users[i].profile.name, last_name: users[i].profile.last_name, company_id: companies[i%companies.length].id, role: users[i].profile.role });
  }

  for (const pair of [
    {table: 'anatomy', rows: anatomy},
    {table: 'equipment', rows: equipment},
    {table: 'exercises', rows: exercises},
    {table: 'classes_template', rows: classes_template},
    {table: 'events', rows: events},
    {table: 'user_cards', rows: user_cards},
  ]) {
    const { error } = await supabase.from(pair.table).insert(pair.rows);
    if (error) throw error;
  }
}

async function uploadFiles() {
  if (!fs.existsSync(FILES_DIR)) {
    console.warn('No files dir found, skipping uploads. Create', FILES_DIR, 'and add files to upload.');
    return;
  }
  const files = fs.readdirSync(FILES_DIR).slice(0, NUM);
  for (let i=0;i<files.length;i++){
    const filePath = path.join(FILES_DIR, files[i]);
    const destPath = `seed/${files[i]}`;
    const file = fs.readFileSync(filePath);
    const { error } = await supabase.storage.from(BUCKET).upload(destPath, file, { upsert: true });
    if (error) {
      console.error('Upload error', error);
    } else {
      console.log('Uploaded', destPath);
    }
  }
}

(async function main(){
  try {
    await ensureBucket();
    const companies = await (async ()=> {
      const rows = [];
      for (let i=0;i<NUM;i++) rows.push({ id: randId(), name: `Company ${i+1}` });
      const { error } = await supabase.from('companies').insert(rows);
      if (error) throw error;
      return rows;
    })();
    const users = await createUsersAndProfiles(companies);
    await seedEntities(companies, users);
    await uploadFiles();
    console.log('Seed finished: created', NUM, 'records per entity and uploaded files (if present).');
    console.log('Users created (email / password):', users.map(u => `${u.email} / ${u.password}`).join('\n'));
  } catch (err) {
    console.error('Error', err);
    process.exit(1);
  }
})();