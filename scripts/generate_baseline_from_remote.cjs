const fs=require('fs');
const src='supabase/remote_public_schema.sql';
const dst='supabase/migrations/20260124160000_Baseline_from_remote.sql';
let s=fs.readFileSync(src,'utf8');
s=s.replace(/CREATE POLICY "([^"]+)" ON "public"\."([^"]+)"/g,(m,name,table)=>`DROP POLICY IF EXISTS "${name}" ON public."${table}";\nCREATE POLICY "${name}" ON "public"."${table}"`);
s += '\n-- Remove local-only columns from previous local schema\nALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS hola;\nALTER TABLE IF EXISTS public.classes_templates DROP COLUMN IF EXISTS name;\n';
fs.writeFileSync(dst,s);
console.log('wrote',dst,'len',s.length);
